import {LoadAssetContainerAsync} from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/core/Animations/animatable.js';

export async function loadRiggedModel(url,scene,spec,size,bottom) {
  const container=await LoadAssetContainerAsync(url,scene);
  try {
    if(!container.skeletons.length||!container.animationGroups.some(group=>group.name==='move'))throw new Error('Animated reef model is missing its rig or clips');
    container.animationGroups.forEach(group=>group.stop());
    container.skeletons.forEach(skeleton=>skeleton.returnToRest());
    const source=container.createRootMesh();source.name='source-'+spec.file;
    source.rotation.set(spec.pitch||0,spec.yaw||0,spec.roll||0);
    container.meshes.forEach(mesh=>{if(mesh.getTotalVertices())mesh.refreshBoundingInfo(true);});
    const bounds=source.getHierarchyBoundingVectors(true),extent=bounds.max.subtract(bounds.min),scale=size/Math.max(extent.x,extent.y,extent.z);
    if(!Number.isFinite(scale)||scale<=0)throw new Error('Invalid animated reef model bounds');
    source.scaling.setAll(scale);
    source.position.set(-(bounds.min.x+bounds.max.x)*scale/2,-(bottom?bounds.min.y:(bounds.min.y+bounds.max.y)/2)*scale,-(bounds.min.z+bounds.max.z)*scale/2);
    const root=container.createRootMesh();root.name=spec.file;container.addAllToScene();
    root.metadata={type:spec.id,height:root.getHierarchyBoundingVectors(true).max.y};
    return {
      root,
      create(name) {
        const instance=container.instantiateModelsToScene(original=>name+'-'+original,false,{doNotInstantiate:true});
        if(instance.rootNodes.length!==1){instance.dispose();throw new Error('Animated reef model must have one root');}
        const node=instance.rootNodes[0];node.name=name;
        const clips=new Map(container.animationGroups.map((group,i)=>[group.name,instance.animationGroups[i]]));
        for(const clip of clips.values())clip.start(true).pause();
        let active=null;
        return {
          node,
          pose(seconds,moving) {
            const clip=clips.get(moving?'move':'idle');
            if(clip!==active){instance.skeletons.forEach(skeleton=>skeleton.returnToRest());active=clip;}
            const fps=clip.targetedAnimations[0].animation.framePerSecond,length=(clip.to-clip.from)/fps;
            clip.goToFrame(clip.from+((seconds%length+length)%length)*fps);
          },
          dispose(){instance.dispose();},
        };
      },
    };
  }catch(error){container.dispose();throw error;}
}
