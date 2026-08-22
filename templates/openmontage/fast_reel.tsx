import React from "react";
import type {CalculateMetadataFunction} from "remotion";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  OffthreadVideo,
  interpolate,
  registerRoot,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type FastReelProps = {
  durationSeconds: number;
  title: string;
  hook: string;
  bodyLines: string[];
  cta: string;
  branding?: string;
  accentColor?: string;
  backgroundColor?: string;
  mediaSrc?: string;
  mediaType?: "image" | "video";
  audioSrc?: string;
};

const FPS = 24;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const resolveSource = (src?: string) => {
  if (!src) return "";
  return /^https?:\/\//i.test(src) ? src : staticFile(src);
};

const Background: React.FC<Pick<FastReelProps, "accentColor" | "backgroundColor" | "mediaSrc" | "mediaType">> = ({
  accentColor = "#67E8F9",
  backgroundColor = "#07111F",
  mediaSrc,
  mediaType,
}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 42) * 70;
  const source = resolveSource(mediaSrc);

  return (
    <AbsoluteFill style={{backgroundColor, overflow: "hidden"}}>
      {source && mediaType === "video" ? (
        <OffthreadVideo
          src={source}
          muted
          style={{width: "100%", height: "100%", objectFit: "cover", opacity: 0.5}}
        />
      ) : source && mediaType === "image" ? (
        <Img
          src={source}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.5,
            transform: `scale(${1.06 + frame / 16000})`,
          }}
        />
      ) : null}

      <AbsoluteFill
        style={{
          background: `
            radial-gradient(circle at ${25 + drift / 20}% 18%, ${accentColor}55 0, transparent 35%),
            radial-gradient(circle at 84% ${76 - drift / 28}%, #8B5CF655 0, transparent 38%),
            linear-gradient(155deg, ${backgroundColor} 0%, #101D34 52%, #050A13 100%)
          `,
          opacity: source ? 0.82 : 1,
        }}
      />

      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          transform: `translateY(${(frame * 0.45) % 72}px)`,
          opacity: 0.75,
        }}
      />

      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          border: `2px solid ${accentColor}33`,
          borderRadius: "50%",
          right: -260 + drift,
          top: 270,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 14,
          height: 1180,
          left: 62,
          top: 340,
          borderRadius: 20,
          background: `linear-gradient(${accentColor}, #8B5CF6)`,
          opacity: 0.78,
        }}
      />
    </AbsoluteFill>
  );
};

const KineticText: React.FC<{
  text: string;
  startFrame: number;
  endFrame: number;
  kind: "hook" | "body" | "cta";
  accentColor: string;
}> = ({text, startFrame, endFrame, kind, accentColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - startFrame;
  const enter = spring({frame: Math.max(0, local), fps, config: {damping: 16, stiffness: 150}});
  const exit = interpolate(frame, [endFrame - 8, endFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(enter, [0, 1], [85, 0]);
  const scale = kind === "hook" ? interpolate(enter, [0, 1], [0.78, 1]) : 1;
  const fontSize = kind === "hook" ? 104 : kind === "cta" ? 88 : 74;

  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        right: 76,
        top: kind === "body" ? 620 : 500,
        minHeight: 420,
        display: "flex",
        alignItems: "center",
        color: "#F8FAFC",
        fontFamily: "Arial Black, Arial, Helvetica, sans-serif",
        fontWeight: 900,
        fontSize,
        lineHeight: 0.98,
        letterSpacing: kind === "body" ? -2 : -4,
        textTransform: "uppercase",
        textShadow: "0 12px 45px rgba(0,0,0,.55)",
        opacity: enter * exit,
        transform: `translateY(${y}px) scale(${scale})`,
        transformOrigin: "left center",
      }}
    >
      <div>
        <div
          style={{
            width: kind === "body" ? 110 : 170,
            height: 10,
            borderRadius: 12,
            background: accentColor,
            marginBottom: 30,
            boxShadow: `0 0 30px ${accentColor}88`,
          }}
        />
        {text}
      </div>
    </div>
  );
};

const CaptionPill: React.FC<{text: string; accentColor: string}> = ({text, accentColor}) => {
  const frame = useCurrentFrame();
  const pulse = 0.96 + Math.sin(frame / 8) * 0.015;
  return (
    <div
      style={{
        position: "absolute",
        left: 84,
        right: 84,
        bottom: 285,
        padding: "24px 32px 27px",
        borderRadius: 30,
        border: "1px solid rgba(255,255,255,.16)",
        background: "rgba(3,8,18,.82)",
        color: "white",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontWeight: 800,
        fontSize: 43,
        lineHeight: 1.08,
        textAlign: "center",
        boxShadow: "0 18px 50px rgba(0,0,0,.38)",
        transform: `scale(${pulse})`,
      }}
    >
      <span style={{color: accentColor}}>● </span>{text}
    </div>
  );
};

const FastReel: React.FC<FastReelProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const accentColor = props.accentColor || "#67E8F9";
  const lines = props.bodyLines.length ? props.bodyLines.slice(0, 6) : [props.title];
  const hookFrames = Math.min(Math.round(fps * 2), Math.round(durationInFrames * 0.16));
  const ctaFrames = Math.min(Math.round(fps * 4), Math.round(durationInFrames * 0.2));
  const bodyStart = hookFrames;
  const bodyEnd = durationInFrames - ctaFrames;
  const bodySpan = Math.max(1, bodyEnd - bodyStart);
  const lineSpan = bodySpan / lines.length;
  const bodyIndex = clamp(Math.floor((frame - bodyStart) / lineSpan), 0, lines.length - 1);
  const activeCaption = frame < hookFrames
    ? props.hook
    : frame >= bodyEnd
      ? props.cta
      : lines[bodyIndex];
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Background
        accentColor={accentColor}
        backgroundColor={props.backgroundColor}
        mediaSrc={props.mediaSrc}
        mediaType={props.mediaType}
      />

      {props.branding ? (
        <div
          style={{
            position: "absolute",
            top: 116,
            left: 84,
            padding: "15px 23px",
            borderRadius: 999,
            background: "rgba(4,10,22,.72)",
            border: `2px solid ${accentColor}88`,
            color: "#F8FAFC",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 800,
            fontSize: 32,
            letterSpacing: 1.2,
          }}
        >
          {props.branding}
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          top: 270,
          left: 84,
          right: 84,
          color: "rgba(248,250,252,.78)",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 900,
          fontSize: 36,
          letterSpacing: 6,
          textTransform: "uppercase",
        }}
      >
        {props.title}
      </div>

      {frame < hookFrames ? (
        <KineticText
          text={props.hook || props.title}
          startFrame={0}
          endFrame={hookFrames}
          kind="hook"
          accentColor={accentColor}
        />
      ) : null}

      {lines.map((line, index) => {
        const start = Math.round(bodyStart + index * lineSpan);
        const end = Math.round(bodyStart + (index + 1) * lineSpan);
        return frame >= start && frame < end ? (
          <KineticText
            key={`${index}-${line}`}
            text={line}
            startFrame={start}
            endFrame={end}
            kind="body"
            accentColor={accentColor}
          />
        ) : null;
      })}

      {frame >= bodyEnd ? (
        <KineticText
          text={props.cta}
          startFrame={bodyEnd}
          endFrame={durationInFrames}
          kind="cta"
          accentColor={accentColor}
        />
      ) : null}

      <CaptionPill text={activeCaption} accentColor={accentColor} />

      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: `${progress * 100}%`,
          height: 13,
          background: `linear-gradient(90deg, ${accentColor}, #8B5CF6)`,
          boxShadow: `0 0 25px ${accentColor}99`,
        }}
      />

      {props.audioSrc ? <Audio src={resolveSource(props.audioSrc)} /> : null}
    </AbsoluteFill>
  );
};

const calculateMetadata: CalculateMetadataFunction<FastReelProps> = async ({props}) => ({
  durationInFrames: Math.round(clamp(Number(props.durationSeconds) || 30, 15, 90) * FPS),
});

const Root: React.FC = () => (
  <Composition
    id="FastReel"
    component={FastReel}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={30 * FPS}
    calculateMetadata={calculateMetadata}
    defaultProps={{
      durationSeconds: 30,
      title: "BUILD MOMENTUM",
      hook: "YOUR NEXT REP STARTS NOW",
      bodyLines: ["SHOW UP", "TRAIN WITH INTENT", "STACK THE WINS"],
      cta: "START TODAY",
      branding: "",
      accentColor: "#67E8F9",
      backgroundColor: "#07111F",
    }}
  />
);

registerRoot(Root);
