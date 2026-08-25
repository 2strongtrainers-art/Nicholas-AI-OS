"""Optional face-aware focus estimation for vertical crops.

Inspired by Video Wizard's MediaPipe smart-clipping concept. The dependency is
optional: if OpenCV/MediaPipe are unavailable, callers receive a centered focus
rather than failing the existing Fast Reel pipeline.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class FaceFocusResult:
    focus_x: float
    focus_y: float
    detections: int
    sampled_frames: int
    mode: str

    def to_dict(self) -> dict:
        return {
            "focus_x": self.focus_x,
            "focus_y": self.focus_y,
            "detections": self.detections,
            "sampled_frames": self.sampled_frames,
            "mode": self.mode,
        }


def estimate_face_focus(
    video_path: str,
    start_seconds: float,
    end_seconds: float,
    sample_fps: float = 2.0,
) -> FaceFocusResult:
    source = Path(video_path).expanduser()
    if not source.is_file():
        raise FileNotFoundError(source)
    if end_seconds <= start_seconds:
        raise ValueError("end_seconds must be greater than start_seconds")

    try:
        import cv2  # type: ignore
        import mediapipe as mp  # type: ignore
    except Exception:
        return FaceFocusResult(0.5, 0.5, 0, 0, "center-fallback-no-mediapipe")

    cap = cv2.VideoCapture(str(source))
    if not cap.isOpened():
        return FaceFocusResult(0.5, 0.5, 0, 0, "center-fallback-open-failed")

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    frame_step = max(1, int(round(fps / max(0.25, sample_fps))))
    start_frame = max(0, int(round(start_seconds * fps)))
    end_frame = max(start_frame + 1, int(round(end_seconds * fps)))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    xs: list[float] = []
    ys: list[float] = []
    sampled = 0
    current = start_frame

    detector = mp.solutions.face_detection.FaceDetection(
        model_selection=1,
        min_detection_confidence=0.5,
    )
    try:
        while current < end_frame:
            ok, frame = cap.read()
            if not ok:
                break
            if (current - start_frame) % frame_step == 0:
                sampled += 1
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = detector.process(rgb)
                detections = list(result.detections or [])
                if detections:
                    # Favor the largest visible face. This is stable for talking-head
                    # and coaching footage and avoids rapidly jumping among faces.
                    def area(det) -> float:
                        box = det.location_data.relative_bounding_box
                        return max(0.0, float(box.width)) * max(0.0, float(box.height))

                    face = max(detections, key=area)
                    box = face.location_data.relative_bounding_box
                    xs.append(max(0.0, min(1.0, float(box.xmin + box.width / 2))))
                    ys.append(max(0.0, min(1.0, float(box.ymin + box.height / 2))))
            current += 1
    finally:
        detector.close()
        cap.release()

    if not xs:
        return FaceFocusResult(0.5, 0.5, 0, sampled, "center-fallback-no-face")

    # Median is deliberately used instead of frame-by-frame camera motion; it
    # yields a stable crop for short Reels and avoids nauseating horizontal pan.
    return FaceFocusResult(
        round(float(statistics.median(xs)), 4),
        round(float(statistics.median(ys)), 4),
        len(xs),
        sampled,
        "mediapipe-static-focus",
    )
