package com.motionlayer.editor
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.motionlayer.data.*
import com.motionlayer.render.KeyframeInterpolator
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow

class EditorViewModel(app:Application):AndroidViewModel(app){
 val project=MutableStateFlow(MotionLayerProject("project_${System.currentTimeMillis()}","Untitled")); val timeMs=MutableStateFlow(0L); val selectedLayerId=MutableStateFlow<String?>(null)
 fun createNewProject(uri:String,ratio:String){ val c=when(ratio){"16:9"->CanvasSpec(1920,1080,30,ratio);"1:1"->CanvasSpec(1080,1080,30,ratio);else->CanvasSpec()}; project.value=MotionLayerProject("project_${System.currentTimeMillis()}","MotionLayer Edit",c,MainVideo(uri,12000)) }
 fun addTextLayer(){ addLayer(Layer(id(),"Text",LayerType.TEXT,text="MotionLayer",zIndex=project.value.layers.size)) }
 fun addShapeLayer(){ addLayer(Layer(id(),"Shape",LayerType.SHAPE,shapeType=ShapeType.ROUNDED_RECTANGLE,zIndex=project.value.layers.size)) }
 fun addImageLayer(uri:String){ addLayer(Layer(id(),"Image",LayerType.IMAGE,sourceUri=uri,zIndex=project.value.layers.size)) }
 fun addVideoOverlayLayer(uri:String){ addLayer(Layer(id(),"Video Overlay",LayerType.VIDEO,sourceUri=uri,zIndex=project.value.layers.size)) }
 private fun addLayer(l:Layer){ project.value=project.value.copy(layers=project.value.layers+l); selectedLayerId.value=l.id }
 fun deleteLayer(){ selectedLayerId.value?.let{ id-> project.value=project.value.copy(layers=project.value.layers.filterNot{it.id==id}); selectedLayerId.value=null } }
 fun duplicateLayer(){ project.value.layers.find{it.id==selectedLayerId.value}?.let{ addLayer(it.copy(id=id(),name="${it.name} Copy",zIndex=project.value.layers.size)) } }
 fun moveLayerUp(){ reorder(1) }; fun moveLayerDown(){ reorder(-1) }
 private fun reorder(delta:Int){ val id=selectedLayerId.value?:return; project.value=project.value.copy(layers=project.value.layers.map{ if(it.id==id) it.copy(zIndex=it.zIndex+delta) else it }) }
 fun updateLayerTransform(x:Float?=null,y:Float?=null,scale:Float?=null,rotZ:Float?=null,opacity:Float?=null){ val id=selectedLayerId.value?:return; project.value=project.value.copy(layers=project.value.layers.map{ if(it.id==id) it.copy(x=x?:it.x,y=y?:it.y,scaleX=scale?:it.scaleX,scaleY=scale?:it.scaleY,rotationZ=rotZ?:it.rotationZ,opacity=opacity?:it.opacity) else it }) }
 fun addKeyframe(){ val idl=selectedLayerId.value?:return; project.value=project.value.copy(layers=project.value.layers.map{ if(it.id==idl) it.copy(keyframes=it.keyframes+Keyframe(id(),idl,timeMs.value,it.x,it.y,it.scaleX,it.scaleY,it.rotationX,it.rotationY,it.rotationZ,it.zDepth,it.opacity,it.style.blur,it.style.shadowOpacity,it.mask.maskX,it.mask.maskY,it.mask.maskWidth,it.mask.maskHeight,EasingMode.Smooth)) else it }) }
 fun updateKeyframe(k:Keyframe){ project.value=project.value.copy(layers=project.value.layers.map{ if(it.id==k.layerId) it.copy(keyframes=it.keyframes.map{old->if(old.id==k.id) k else old}) else it }) }
 fun deleteKeyframe(keyId:String){ project.value=project.value.copy(layers=project.value.layers.map{ it.copy(keyframes=it.keyframes.filterNot{k->k.id==keyId}) }) }
 fun interpolateLayerAtTime(layer:Layer,time:Long)=KeyframeInterpolator.interpolateLayerAtTime(layer,time)
 fun saveProject()=ProjectRepository(getApplication()).saveProject(project.value)
 fun loadProject(projectId:String){ project.value=ProjectRepository(getApplication()).loadProject(projectId) }
 private fun id()=UUID.randomUUID().toString()
}
