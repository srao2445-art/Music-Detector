package com.motionlayer.utils
import android.content.Context; import android.net.Uri; import androidx.media3.common.MediaItem
object MediaUtils { fun mediaItem(uri:String)=MediaItem.fromUri(Uri.parse(uri)); fun displayName(context:Context,uri:Uri)=uri.lastPathSegment ?: "media" }
