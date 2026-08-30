import type { NonverbalRawSample } from "./nonverbal";

// WASM matches the installed @mediapipe/tasks-vision version. Models are Google's
// public MediaPipe assets. Everything runs in the browser; nothing is uploaded.
const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type FaceLandmarker = import("@mediapipe/tasks-vision").FaceLandmarker;
type PoseLandmarker = import("@mediapipe/tasks-vision").PoseLandmarker;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/**
 * Loads MediaPipe Face + Pose Landmarker lazily and turns a single video frame
 * into a {@link NonverbalRawSample}. Created only when the user enables the
 * camera, so the ~large vision bundle stays out of the initial page load.
 */
export class NonverbalAnalyzer {
  private face: FaceLandmarker | null = null;
  private pose: PoseLandmarker | null = null;
  private ready = false;

  get isReady(): boolean {
    return this.ready;
  }

  async init(): Promise<void> {
    if (this.ready) return;
    const { FilesetResolver, FaceLandmarker, PoseLandmarker } = await import(
      "@mediapipe/tasks-vision"
    );
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

    const makeFace = (delegate: "GPU" | "CPU") =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
    const makePose = (delegate: "GPU" | "CPU") =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
      });

    try {
      [this.face, this.pose] = await Promise.all([
        makeFace("GPU"),
        makePose("GPU"),
      ]);
    } catch {
      [this.face, this.pose] = await Promise.all([
        makeFace("CPU"),
        makePose("CPU"),
      ]);
    }
    this.ready = true;
  }

  /**
   * Detect on the current frame. `tMs` must strictly increase across calls
   * (pass `performance.now()`); `tSinceStart` is stored on the sample.
   */
  sample(
    video: HTMLVideoElement,
    tMs: number,
    tSinceStart: number,
  ): NonverbalRawSample {
    const out: NonverbalRawSample = {
      t: tSinceStart,
      face: false,
      yaw: 0,
      pitch: 0,
      roll: 0,
      gaze: 0,
      facingForward: false,
      smile: 0,
      brow: 0,
      faceArea: 0,
      pose: false,
      shoulderAngle: null,
      headOffsetX: null,
    };
    if (!this.ready || !this.face || !this.pose) return out;

    let faceRes: ReturnType<FaceLandmarker["detectForVideo"]> | null = null;
    let poseRes: ReturnType<PoseLandmarker["detectForVideo"]> | null = null;
    try {
      faceRes = this.face.detectForVideo(video, tMs);
    } catch {
      faceRes = null;
    }
    try {
      poseRes = this.pose.detectForVideo(video, tMs);
    } catch {
      poseRes = null;
    }

    const lm = faceRes?.faceLandmarks?.[0];
    const blend = faceRes?.faceBlendshapes?.[0]?.categories;
    if (lm && lm.length > 400) {
      out.face = true;

      let minX = 1;
      let minY = 1;
      let maxX = 0;
      let maxY = 0;
      for (const p of lm) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      out.faceArea = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);

      const leftEye = {
        x: (lm[33].x + lm[133].x) / 2,
        y: (lm[33].y + lm[133].y) / 2,
      };
      const rightEye = {
        x: (lm[362].x + lm[263].x) / 2,
        y: (lm[362].y + lm[263].y) / 2,
      };
      const nose = lm[1];
      const chin = lm[152];
      const faceLeft = lm[234];
      const faceRight = lm[454];

      out.roll =
        (Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180) /
        Math.PI;

      const midX = (faceLeft.x + faceRight.x) / 2;
      const halfW = Math.max(1e-4, (faceRight.x - faceLeft.x) / 2);
      out.yaw = clamp(((nose.x - midX) / halfW) * 55, -90, 90);

      // Nose tip sits ~0.36 of the way from the eye line to the chin at neutral;
      // the ratio is noisy, so keep the gain modest.
      const eyeY = (leftEye.y + rightEye.y) / 2;
      const denom = Math.max(1e-4, chin.y - eyeY);
      out.pitch = clamp(((nose.y - eyeY) / denom - 0.36) * 120, -70, 70);

      if (blend) {
        const b = (name: string) =>
          blend.find((c) => c.categoryName === name)?.score ?? 0;
        const gazeH = Math.max(
          b("eyeLookOutLeft"),
          b("eyeLookInLeft"),
          b("eyeLookOutRight"),
          b("eyeLookInRight"),
        );
        const gazeV = Math.max(
          b("eyeLookUpLeft"),
          b("eyeLookUpRight"),
          b("eyeLookDownLeft"),
          b("eyeLookDownRight"),
        );
        out.gaze = clamp(Math.max(gazeH, gazeV), 0, 1);
        out.smile = clamp((b("mouthSmileLeft") + b("mouthSmileRight")) / 2, 0, 1);
        // browDown blendshapes also fire from the eye-narrowing of a big smile,
        // so damp the tension reading when the mouth is clearly smiling.
        out.brow = clamp(
          (b("browDownLeft") + b("browDownRight")) / 2 +
            0.35 * b("browInnerUp") -
            0.7 * out.smile,
          0,
          1,
        );
      }

      // "Looking at the camera": head roughly frontal and eyes not darting off.
      // Yaw and gaze carry most of the signal; pitch is the least reliable.
      out.facingForward =
        Math.abs(out.yaw) < 20 && Math.abs(out.pitch) < 25 && out.gaze < 0.45;
    }

    const pl = poseRes?.landmarks?.[0];
    if (pl && pl.length > 24) {
      const leftShoulder = pl[11];
      const rightShoulder = pl[12];
      const poseNose = pl[0];
      const vis = (p: { visibility?: number } | undefined) =>
        typeof p?.visibility === "number" ? p.visibility : 1;
      if (vis(leftShoulder) > 0.5 && vis(rightShoulder) > 0.5) {
        out.pose = true;
        out.shoulderAngle =
          (Math.atan2(
            rightShoulder.y - leftShoulder.y,
            Math.abs(rightShoulder.x - leftShoulder.x) || 1e-4,
          ) *
            180) /
          Math.PI;
        if (poseNose) {
          out.headOffsetX =
            poseNose.x - (leftShoulder.x + rightShoulder.x) / 2;
        }
      }
    }

    return out;
  }

  close(): void {
    try {
      this.face?.close();
    } catch {
      /* ignore */
    }
    try {
      this.pose?.close();
    } catch {
      /* ignore */
    }
    this.face = null;
    this.pose = null;
    this.ready = false;
  }
}
