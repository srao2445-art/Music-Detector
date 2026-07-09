package com.motionlayer.editor
import android.net.Uri
import androidx.compose.foundation.*; import androidx.compose.foundation.layout.*; import androidx.compose.foundation.shape.RoundedCornerShape; import androidx.compose.runtime.*; import androidx.compose.ui.*; import androidx.compose.ui.graphics.Color; import androidx.compose.ui.platform.LocalContext; import androidx.compose.ui.viewinterop.AndroidView; import androidx.compose.ui.unit.dp
import androidx.media3.common.MediaItem; import androidx.media3.exoplayer.ExoPlayer; import androidx.media3.ui.PlayerView
import com.motionlayer.data.MotionLayerProject; import com.motionlayer.render.*
@Composable fun PreviewCanvas(project:MotionLayerProject,timeMs:Long,modifier:Modifier=Modifier){ val ctx= LocalContext.current; val player= remember(project.mainVideo.uri){ ExoPlayer.Builder(ctx).build().apply{ if(project.mainVideo.uri.isNotBlank()){ setMediaItem(MediaItem.fromUri(Uri.parse(project.mainVideo.uri))); prepare() } } }; DisposableEffect(player){ onDispose{player.release()} }
 Box(modifier.background(Color(0xff08090c)).padding(12.dp), contentAlignment=Alignment.Center){ Box(Modifier.aspectRatio(project.canvas.width.toFloat()/project.canvas.height).fillMaxHeight().clip(RoundedCornerShape(2.dp)).background(Color(0xfffff3df))){ if(project.mainVideo.uri.isNotBlank()) AndroidView({ PlayerView(it).apply{ this.player=player; useController=false }}, Modifier.matchParentSize()); RenderEngine().visibleLayers(project,timeMs).forEach{ LayerRenderer(it, Modifier) } } }
}
