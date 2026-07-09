package com.motionlayer.editor
import androidx.compose.foundation.layout.*; import androidx.compose.material3.*; import androidx.compose.runtime.Composable; import androidx.compose.ui.Modifier; import androidx.compose.ui.unit.dp
@Composable fun LayerPanel(vm:EditorViewModel){ Row(Modifier.fillMaxWidth(), horizontalArrangement=Arrangement.spacedBy(8.dp)){ Button(onClick=vm::addTextLayer){Text("Text")}; Button(onClick=vm::addShapeLayer){Text("Shape")}; Button(onClick=vm::duplicateLayer){Text("Duplicate")}; Button(onClick=vm::deleteLayer){Text("Delete")} } }
