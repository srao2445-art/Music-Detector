# MotionLayer

MotionLayer is a native Android/Kotlin prototype for a CapCut add-on style overlay motion editor. It intentionally has **no template system**, no preset template categories, and no ready-made template JSON files.

## Build

```bash
gradle :app:assembleDebug
```

Requires Android SDK 35, JDK 17+, and network access for first dependency resolution.

## Run

Open the project in Android Studio or install the debug APK from `app/build/outputs/apk/debug/app-debug.apk`.

## Implemented features

- Home screen with new project and recent local JSON projects.
- Import screen using Android storage picker for a main video and 9:16, 16:9, or 1:1 canvas choices.
- Editor screen with video preview, overlay rendering, layer controls, property sliders, keyframe creation, draggable/tappable timeline seeking, project save, and export entry point.
- Layer model for video, image, text, and shape layers with transform, style, mask, motion blur, and keyframe fields.
- Keyframe interpolation with Linear, Ease In, Ease Out, Ease In Out, Smooth, Bounce, Elastic, and Back easing.
- Local project JSON serialization using kotlinx.serialization.
- Export screen and `VideoExporter` architecture stub prepared for Media3 Transformer/GPU compositing integration.

## Known limitations

- Export currently simulates progress and documents the Media3/GPU handoff; full hardware layer compositing is marked for future implementation.
- Image/video overlay picking buttons are not wired into the first skeleton UI yet, though ViewModel APIs exist.
- Preview uses Compose graphics layers for fake 3D, blur, opacity, scale, rotation, and shadows where supported.
- Media duration is initialized to a safe default in this prototype.

## Future improvements

- Implement frame-accurate Media3 Transformer composition with a GL shader pipeline.
- Add file pickers for image and video overlay layers in the layer panel.
- Add detailed controls for masks, reflections, motion blur direction, text typography, and shape stroke editing.
- Add waveform analysis for the audio placeholder track.
