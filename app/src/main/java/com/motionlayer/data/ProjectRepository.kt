package com.motionlayer.data
import android.content.Context
import java.io.File
class ProjectRepository(private val context: Context) {
 private val dir get() = File(context.filesDir,"projects").apply{mkdirs()}
 fun saveProject(project: MotionLayerProject): File = File(dir,"${project.projectId}.json").also{ it.writeText(JsonProjectSerializer.encode(project)) }
 fun loadProject(id:String): MotionLayerProject = JsonProjectSerializer.decode(File(dir,"$id.json").readText())
 fun recentProjects(): List<MotionLayerProject> = dir.listFiles { f -> f.extension=="json" }?.sortedByDescending{it.lastModified()}?.mapNotNull{ runCatching{JsonProjectSerializer.decode(it.readText())}.getOrNull() } ?: emptyList()
}
