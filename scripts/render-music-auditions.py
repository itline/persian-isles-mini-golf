#!/usr/bin/env python3
"""Render three original, deterministic mini-golf music audition clips.

This renderer owns only public/music-audition/ and never imports or edits the
live game's audio source. It uses NumPy for synthesis and ffmpeg for optional
MP3 encoding plus a decode-back validation pass.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "music-audition"
SAMPLE_RATE = 44_100
DURATION = 30.0
TARGET_RMS = 0.125


def hz(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def pan_gains(pan: float) -> tuple[float, float]:
    angle = (float(np.clip(pan, -1.0, 1.0)) + 1.0) * math.pi / 4.0
    return math.cos(angle), math.sin(angle)


def note_envelope(length: int, attack: float, release: float) -> np.ndarray:
    env = np.ones(length, dtype=np.float32)
    attack_n = min(length, max(1, int(attack * SAMPLE_RATE)))
    release_n = min(length, max(1, int(release * SAMPLE_RATE)))
    env[:attack_n] = np.linspace(0.0, 1.0, attack_n, endpoint=False)
    env[-release_n:] *= np.linspace(1.0, 0.0, release_n, endpoint=True)
    return env


def add_note(buf: np.ndarray, start: float, length: float, midi: float, amp: float,
             kind: str = "soft", pan: float = 0.0, vibrato: float = 0.0) -> None:
    start_i = int(start * SAMPLE_RATE)
    count = min(int(length * SAMPLE_RATE), buf.shape[1] - start_i)
    if count <= 0:
        return
    t = np.arange(count, dtype=np.float64) / SAMPLE_RATE
    f = hz(midi)
    if vibrato:
        f = f * (1.0 + vibrato * np.sin(2.0 * math.pi * 5.0 * t))
    phase = (2.0 * math.pi * f * t if np.isscalar(f)
             else 2.0 * math.pi * np.cumsum(f) / SAMPLE_RATE)
    if kind == "mallet":
        wave_ = (0.86 * np.sin(phase) + 0.20 * np.sin(2.01 * phase)
                 + 0.08 * np.sin(3.98 * phase))
        env = np.exp(-4.8 * t / max(length, 0.01)) * note_envelope(count, 0.002, 0.04)
        wave_ = wave_ + 0.18 * np.exp(-85.0 * t)
    elif kind == "bell":
        wave_ = (0.58 * np.sin(phase) + 0.27 * np.sin(2.01 * phase)
                 + 0.14 * np.sin(3.02 * phase) + 0.07 * np.sin(4.11 * phase))
        env = np.exp(-3.7 * t / max(length, 0.01)) * note_envelope(count, 0.002, 0.16)
    elif kind == "bass":
        wave_ = 0.92 * np.sin(phase) + 0.16 * np.sin(2.0 * phase)
        env = note_envelope(count, 0.018, min(0.12, length * 0.25))
    elif kind == "pluck":
        wave_ = (0.74 * np.sin(phase) + 0.25 * np.sin(2.0 * phase)
                 + 0.11 * np.sin(3.0 * phase))
        env = np.exp(-5.2 * t / max(length, 0.01)) * note_envelope(count, 0.003, 0.06)
    else:
        wave_ = 0.92 * np.sin(phase) + 0.08 * np.sin(2.0 * phase)
        env = note_envelope(count, 0.04, min(0.20, length * 0.30))
    wave_ = amp * wave_.astype(np.float32) * env.astype(np.float32)
    left, right = pan_gains(pan)
    buf[0, start_i:start_i + count] += wave_ * left
    buf[1, start_i:start_i + count] += wave_ * right


def add_kick(buf: np.ndarray, start: float, amp: float = 0.24) -> None:
    start_i = int(start * SAMPLE_RATE)
    count = min(int(0.34 * SAMPLE_RATE), buf.shape[1] - start_i)
    if count <= 0:
        return
    t = np.arange(count, dtype=np.float64) / SAMPLE_RATE
    freq = 112.0 - 54.0 * np.minimum(t / 0.34, 1.0)
    phase = 2.0 * math.pi * np.cumsum(freq) / SAMPLE_RATE
    sig = amp * (np.sin(phase) * np.exp(-11.0 * t) + 0.12 * np.sin(2 * math.pi * 1_800 * t) * np.exp(-55 * t))
    buf[:, start_i:start_i + count] += sig.astype(np.float32)


def add_shaker(buf: np.ndarray, start: float, amp: float = 0.055, seed: int = 1) -> None:
    start_i = int(start * SAMPLE_RATE)
    count = min(int(0.085 * SAMPLE_RATE), buf.shape[1] - start_i)
    if count <= 0:
        return
    rng = np.random.default_rng(seed + start_i)
    noise = rng.standard_normal(count).astype(np.float32)
    env = np.exp(-38.0 * np.arange(count, dtype=np.float32) / SAMPLE_RATE)
    sig = noise * env * amp
    buf[0, start_i:start_i + count] += sig * 0.85
    buf[1, start_i:start_i + count] += sig * 0.72


def add_soft_pulse(buf: np.ndarray, start: float, amp: float = 0.05) -> None:
    start_i = int(start * SAMPLE_RATE)
    count = min(int(0.18 * SAMPLE_RATE), buf.shape[1] - start_i)
    if count <= 0:
        return
    t = np.arange(count, dtype=np.float32) / SAMPLE_RATE
    sig = amp * np.sin(2 * math.pi * 185 * t) * np.exp(-18 * t)
    buf[0, start_i:start_i + count] += sig
    buf[1, start_i:start_i + count] += sig * 0.86


def coastal_pulse() -> np.ndarray:
    """Warm electric-piano melody over a relaxed, gently syncopated pulse."""
    buf = np.zeros((2, int(DURATION * SAMPLE_RATE)), dtype=np.float32)
    bpm = 96.0
    beat = 60.0 / bpm
    roots = [50, 43, 45, 50]  # D, G, A, D: a clear major-key home
    melodies = [
        [74, 76, 78, 81, 78, 76, 74, 69],
        [74, 76, 79, 83, 81, 79, 76, 74],
        [73, 76, 81, 83, 81, 76, 73, 71],
        [74, 78, 81, 85, 81, 78, 76, 74],
    ]
    for bar in range(12):
        base = bar * 4 * beat
        root = roots[bar % len(roots)]
        add_note(buf, base, 3.55 * beat, root, 0.17, "bass", -0.05)
        for step, interval in enumerate((0, 4, 7)):
            add_note(buf, base + 0.08, 3.75 * beat, root + interval + 12,
                     0.045, "soft", 0.10 * (step - 1), vibrato=0.004)
        for eighth in (0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5):
            add_kick(buf, base + eighth * beat, 0.18 if eighth in (0.0, 2.0) else 0.10)
            if eighth in (1.0, 3.0):
                add_soft_pulse(buf, base + eighth * beat, 0.045)
            if eighth % 1.0 == 0.5:
                add_shaker(buf, base + eighth * beat, 0.036, seed=19 + bar)
        for i, midi in enumerate(melodies[bar % 4]):
            start = base + (i * 0.5 + (0.12 if bar % 2 else 0.0)) * beat
            add_note(buf, start, 0.42 * beat, midi,
                     0.105, "pluck", 0.28 * math.sin(i), vibrato=0.006)
    return buf


def sunlit_marimba() -> np.ndarray:
    """Bright marimba-like hooks, handclaps made from filtered noise, and major arpeggios."""
    buf = np.zeros((2, int(DURATION * SAMPLE_RATE)), dtype=np.float32)
    bpm = 108.0
    beat = 60.0 / bpm
    chords = [(60, 64, 67), (57, 60, 64), (65, 69, 72), (55, 59, 62)]
    hook = [76, 79, 81, 79, 76, 74, 76, 79]
    for bar in range(14):
        base = bar * 4 * beat
        chord = chords[bar % len(chords)]
        for i, midi in enumerate(chord):
            add_note(buf, base + 0.02 + i * 0.06, 1.9 * beat, midi, 0.052, "soft", -0.2 + i * 0.2)
        for step in range(8):
            note = hook[(step + bar * 2) % len(hook)] + (0 if bar < 6 else 12)
            add_note(buf, base + step * 0.5 * beat, 0.34 * beat, note, 0.12, "mallet",
                     -0.32 if step % 2 == 0 else 0.30)
            if step in (0, 2, 4, 6):
                add_soft_pulse(buf, base + step * 0.5 * beat, 0.035)
        for half in range(8):
            if half in (0, 4):
                add_kick(buf, base + half * 0.5 * beat, 0.15)
            if half in (2, 6):
                add_shaker(buf, base + half * 0.5 * beat, 0.040, seed=73 + bar)
        add_note(buf, base + 1.5 * beat, 0.20 * beat, chord[1] + 12, 0.075, "mallet", -0.5)
        add_note(buf, base + 3.5 * beat, 0.20 * beat, chord[2] + 12, 0.075, "mallet", 0.5)
    return buf


def tide_and_bells() -> np.ndarray:
    """Airy suspended harmony and soft bell answers; light and welcoming, never ominous."""
    buf = np.zeros((2, int(DURATION * SAMPLE_RATE)), dtype=np.float32)
    bpm = 84.0
    beat = 60.0 / bpm
    chords = [(60, 64, 67), (65, 69, 72), (67, 71, 74), (60, 64, 67)]
    bell_line = [79, 81, 84, 81, 79, 76, 79, 84]
    for bar in range(12):
        base = bar * 4 * beat
        chord = chords[bar % len(chords)]
        for i, midi in enumerate(chord):
            add_note(buf, base, 3.8 * beat, midi + 12, 0.040, "soft",
                     -0.34 + i * 0.34, vibrato=0.008)
        add_note(buf, base, 3.5 * beat, chord[0] - 12, 0.095, "bass", 0.0)
        for i in range(4):
            add_note(buf, base + (i + 0.25) * beat, 0.72 * beat,
                     bell_line[(i + bar) % len(bell_line)] + (12 if bar in (4, 5) else 0),
                     0.095, "bell", -0.42 if i % 2 == 0 else 0.42)
        for half in (0.0, 2.0, 3.0):
            add_soft_pulse(buf, base + half * beat, 0.028)
        for half in (1.0, 3.0):
            add_shaker(buf, base + half * beat, 0.027, seed=101 + bar)
    return buf


def finish(buf: np.ndarray) -> np.ndarray:
    # Gentle saturation keeps the hand-built peaks musical before matching level.
    x = np.tanh(buf * 1.45)
    fade = int(0.75 * SAMPLE_RATE)
    x[:, :fade] *= np.linspace(0.0, 1.0, fade, dtype=np.float32)
    x[:, -fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
    rms = float(np.sqrt(np.mean(x * x)))
    if not math.isfinite(rms) or rms <= 1e-8:
        raise RuntimeError("synthesis produced silence or non-finite values")
    x *= TARGET_RMS / rms
    peak = float(np.max(np.abs(x)))
    if peak >= 0.93:
        x *= 0.88 / peak
    if not np.isfinite(x).all() or not np.any(x):
        raise RuntimeError("finished audio is invalid")
    return np.clip(x, -0.98, 0.98)


def write_wav(path: Path, samples: np.ndarray) -> None:
    interleaved = np.clip(samples.T.reshape(-1), -1.0, 1.0)
    pcm = (interleaved * 32767.0).round().astype('<i2').tobytes()
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(SAMPLE_RATE)
        out.writeframes(pcm)


def ffmpeg_path() -> str | None:
    found = shutil.which('ffmpeg')
    if found:
        return found
    candidate = Path('/Users/hasan/.hermes/tools/ffmpeg-9.0.1-darwin-arm64/ffmpeg')
    return str(candidate) if candidate.exists() else None


def encode_mp3(ffmpeg: str, wav: Path, mp3: Path) -> None:
    subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', str(wav), '-codec:a', 'libmp3lame',
                    '-b:a', '192k', '-ar', str(SAMPLE_RATE), str(mp3)], check=True)


def loudness(ffmpeg: str, path: Path) -> dict:
    result = subprocess.run([ffmpeg, '-hide_banner', '-i', str(path), '-af',
                             'loudnorm=I=-19:TP=-2:LRA=7:print_format=json', '-f', 'null', '-'],
                            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    text = result.stderr
    return json.loads(text[text.rfind('{'):text.rfind('}') + 1])


def normalize_loudness(ffmpeg: str, path: Path) -> dict:
    measured = loudness(ffmpeg, path)
    args = ':'.join(['loudnorm=I=-19:TP=-2:LRA=7',
                     f"measured_I={measured['input_i']}",
                     f"measured_TP={measured['input_tp']}",
                     f"measured_LRA={measured['input_lra']}",
                     f"measured_thresh={measured['input_thresh']}",
                     f"offset={measured['target_offset']}", 'linear=true'])
    normalized = path.with_name(path.stem + '-normalized.wav')
    subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', str(path), '-af', args,
                    '-ar', str(SAMPLE_RATE), '-c:a', 'pcm_s16le', str(normalized)], check=True)
    normalized.replace(path)
    verified = loudness(ffmpeg, path)
    return {'integrated_lufs': float(verified['input_i']),
            'true_peak_dbtp': float(verified['input_tp']),
            'loudness_range_lu': float(verified['input_lra'])}


def wav_metrics(path: Path) -> dict[str, float | int | bool]:
    with wave.open(str(path), 'rb') as src:
        channels = src.getnchannels()
        rate = src.getframerate()
        frames = src.getnframes()
        raw = src.readframes(frames)
        samples = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    rms = float(np.sqrt(np.mean(samples * samples)))
    peak = float(np.max(np.abs(samples)))
    return {'channels': channels, 'sample_rate': rate, 'frames': frames,
            'duration_seconds': frames / rate, 'rms': rms, 'peak': peak,
            'finite': bool(np.isfinite(samples).all()),
            'nonzero_samples': int(np.count_nonzero(samples))}


def mp3_decode_metrics(ffmpeg: str, path: Path) -> dict[str, float | int | bool]:
    result = subprocess.run([ffmpeg, '-v', 'error', '-i', str(path), '-f', 's16le', '-ac', '2',
                             '-ar', str(SAMPLE_RATE), 'pipe:1'], check=True, stdout=subprocess.PIPE)
    samples = np.frombuffer(result.stdout, dtype='<i2').astype(np.float64) / 32768.0
    if samples.size == 0:
        raise RuntimeError(f'MP3 decode returned no audio: {path}')
    return {'duration_seconds': samples.size / 2 / SAMPLE_RATE,
            'rms': float(np.sqrt(np.mean(samples * samples))),
            'peak': float(np.max(np.abs(samples))),
            'finite': bool(np.isfinite(samples).all()),
            'nonzero_samples': int(np.count_nonzero(samples))}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=OUT)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    ffmpeg = ffmpeg_path()
    if not ffmpeg:
        raise SystemExit('ffmpeg is required to make the requested MP3 audition copies')
    concepts = {
        'coastal-pulse': coastal_pulse,
        'sunlit-marimba': sunlit_marimba,
        'tide-and-bells': tide_and_bells,
    }
    report: dict[str, dict] = {}
    for slug, renderer in concepts.items():
        samples = finish(renderer())
        wav = output / f'{slug}.wav'
        mp3 = output / f'{slug}.mp3'
        write_wav(wav, samples)
        loudness_info = normalize_loudness(ffmpeg, wav)
        encode_mp3(ffmpeg, wav, mp3)
        wav_info = wav_metrics(wav)
        mp3_info = mp3_decode_metrics(ffmpeg, mp3)
        if not (25.0 <= wav_info['duration_seconds'] <= 35.0):
            raise RuntimeError(f'{slug} duration outside requested range')
        if wav_info['peak'] >= 0.999 or not wav_info['finite'] or wav_info['nonzero_samples'] == 0:
            raise RuntimeError(f'{slug} WAV validation failed')
        if not mp3_info['finite'] or mp3_info['nonzero_samples'] == 0 or mp3_info['peak'] >= 0.999:
            raise RuntimeError(f'{slug} MP3 decode validation failed')
        if abs(loudness_info['integrated_lufs'] + 19.0) > 0.5:
            raise RuntimeError(f'{slug} loudness was not matched')
        report[slug] = {'wav': wav_info, 'mp3_decode': mp3_info, 'loudness': loudness_info,
                        'wav_bytes': wav.stat().st_size, 'mp3_bytes': mp3.stat().st_size}
    (output / 'metrics.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
