package com.motionlayer.ui.theme
import androidx.compose.material3.*; import androidx.compose.runtime.Composable; import androidx.compose.ui.graphics.Color
@Composable fun MotionLayerTheme(content:@Composable()->Unit){ MaterialTheme(colorScheme=darkColorScheme(primary=Color(0xff24d9ff), secondary=Color(0xff7c5cff), surface=Color(0xff171717), background=Color(0xff101010)), content=content) }
