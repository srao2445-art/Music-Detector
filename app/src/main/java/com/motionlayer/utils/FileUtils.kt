package com.motionlayer.utils
import android.content.Context
object FileUtils { fun projectDirectory(context: Context)=context.filesDir.resolve("projects").apply{mkdirs()} }
