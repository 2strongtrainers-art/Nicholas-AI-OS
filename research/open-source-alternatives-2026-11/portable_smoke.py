#!/usr/bin/env python3
"""Open-source, no-Higgsfield CPU smoke test. Requires Pillow and FFmpeg.

This demonstrates 9:16 video editing/export, NOT AI footage generation, voice
cloning or ComfyUI model inference. It never uses the network or paid APIs.
"""
import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

CARDS = [
    ('33 DAYS', 'OF DIGITAL DISRUPTION', 'GLOBAL TIMELINE  |  NOVEMBER 13, 2026'),
    ('AWS TOKYO', 'EC2 API + NETWORK OUTAGE', 'NOV 11–12  |  AWS HEALTH DASHBOARD'),
    ('FAA', 'NATIONWIDE GROUND STOP', 'NOV 13  |  COMMUNICATIONS FAILURE'),
    ('NOT PROVEN', 'ONE GLOBAL ATTACK', 'CORRELATION DOES NOT ESTABLISH CAUSATION'),
]


def make_card(i, dest):
    im = Image.new('RGB', (720, 1280), (7, 18, 35))
    dr = ImageDraw.Draw(im)
    def font(size):
        paths = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                 '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf']
        for file in paths:
            if Path(file).is_file():
                return ImageFont.truetype(file, size)
        return ImageFont.load_default()
    red, white, gray = (247, 73, 91), (246, 250, 255), (175, 197, 211)
    for x in range(0,720,47): dr.line((x,120,x,1190), fill=(16,41,61),width=1)
    for y in range(120,1200,50): dr.line((20,y,700,y), fill=(17,39,59),width=1)
    dr.polygon([(24,65),(53,22),(82,65),(66,65),(53,47),(39,65)], fill=red)
    dr.text((100,29), 'TRIVALLEY CONSULTANTS', font=font(27), fill=white)
    dr.line((27,116,691,116),fill=red,width=4)
    dr.text((29,165),'RESEARCH BRIEF  /  2026',font=font(21),fill=gray)
    dr.text((30,325),CARDS[i][0],font=font(64),fill=white)
    dr.line((30,440,690,440),fill=red,width=5)
    dr.rounded_rectangle((27,538,693,845),radius=25,fill=(11,33,52),outline=red,width=3)
    dr.text((48,607),CARDS[i][1],font=font(31),fill=white)
    dr.text((47,912),CARDS[i][2],font=font(22),fill=gray)
    dr.rounded_rectangle((28,1050,690,1122),radius=15,fill=(25,47,65),outline=red,width=2)
    dr.text((43,1070),'FACTS FIRST  /  NO UNSUPPORTED ATTRIBUTION',font=font(17),fill=red)
    dr.text((31,1203),'DEMO: LOCAL GRAPHICS, NOT GENERATIVE VIDEO',font=font(15),fill=gray)
    im.save(dest)


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--output',required=True,type=Path)
    p.add_argument('--voice',type=Path,help='Optional authorized audio file')
    p.add_argument('--seconds-per-card',type=float,default=2.2)
    a=p.parse_args()
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        p.error('ffmpeg and ffprobe must be installed')
    if a.seconds_per_card<0.5 or a.seconds_per_card>10: p.error('Invalid card duration')
    if a.voice and not a.voice.is_file(): p.error('Voice file not found')
    a.output.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as directory:
        root=Path(directory)
        filenames=[]
        for i in range(len(CARDS)):
            png=root/f'frame_{i}.png'
            clip=root/f'clip_{i}.mp4'
            make_card(i,png)
            subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-loop','1',
                            '-framerate','24','-i',str(png),'-t',str(a.seconds_per_card),
                            '-vf','format=yuv420p','-c:v','libx264','-preset','veryfast',
                            '-crf','23','-r','24',str(clip)],check=True,timeout=40)
            filenames.append(clip)
        playlist=root/'clips.txt'
        playlist.write_text(''.join("file '"+str(p)+"'\n" for p in filenames))
        silent=root/'silent.mp4'
        subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat',
                        '-safe','0','-i',str(playlist),'-c','copy',str(silent)],
                       check=True,timeout=40)
        if a.voice:
            subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(silent),
                            '-i',str(a.voice),'-c:v','copy','-c:a','aac',
                            '-shortest',str(a.output)],check=True,timeout=40)
        else: shutil.copy2(silent,a.output)
    verify=subprocess.run(['ffprobe','-v','error','-show_entries',
                           'stream=codec_name,width,height:format=duration,size',
                           '-of','default=noprint_wrappers=1',str(a.output)],
                          check=True,text=True,capture_output=True,timeout=10)
    print(verify.stdout.strip())

if __name__=='__main__': main()
