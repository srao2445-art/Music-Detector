package com.motionlayer.editor
import androidx.compose.material3.*; import androidx.compose.runtime.Composable
@Composable fun KeyframePanel(vm:EditorViewModel){ AssistChip(onClick=vm::addKeyframe,label={Text("◆ Add keyframe")}) }
