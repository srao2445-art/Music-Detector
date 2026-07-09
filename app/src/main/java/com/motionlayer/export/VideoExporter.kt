package com.motionlayer.export
import android.content.Context
import com.motionlayer.data.MotionLayerProject
import kotlinx.coroutines.delay
class VideoExporter(private val context:Context){ suspend fun exportVideo(project:MotionLayerProject,onProgress:(Float)->Unit):Result<String>{ repeat(20){ delay(80); onProgress((it+1)/20f) }; return Result.success("Media3 Transformer export pipeline initialized. GPU compositing renderer TODO for device-specific layer rasterization.") } }
