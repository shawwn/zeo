const NPC_PLUGIN = 'plugins-npc';
const SWORD_LENGTH = 0.5;
const dataSymbol = Symbol();

const sword = ({archae}) => {
  const {three, pose, input, render, elements, items, teleport} = zeo;
  const {THREE, scene} = three;

  const localRotationQuaterion = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    Math.PI / 4
  ).premultiply(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 0, 0)
  ));
  const zeroQuaternion = new THREE.Quaternion();

  let npcElement = null;
  const elementListener = elements.makeListener(NPC_PLUGIN);
  elementListener.on('add', entityElement => {
    npcElement = entityElement;
  });
  elementListener.on('remove', () => {
    npcElement = null;
  });

  return () => {
    const swordApi = {
      asset: 'ITEM.SWORD',
      itemAddedCallback(grabbable) {
        let grabbed = false;
        const _grab = e => {
          grabbable.setLocalRotation(localRotationQuaterion.toArray());

          grabbed = true;
        };
        grabbable.on('grab', _grab);
        const _release = e => {
          grabbable.setLocalRotation(zeroQuaternion.toArray());

          grabbed = false;
        };
        grabbable.on('release', _release);

        const ray = new THREE.Ray();
        const direction = new THREE.Vector3();
        const _update = () => {
          if (grabbed && npcElement) {
            const {gamepads} = pose.getStatus();
            const side = grabbable.getGrabberSide();
            const gamepad = gamepads[side];
            const {worldPosition: controllerPosition, worldRotation: controllerRotation} = gamepad;
            direction.set(0, 0, -1).applyQuaternion(controllerRotation);
            ray.set(controllerPosition, direction);
            const hitNpc = npcElement.getHitNpc(ray, SWORD_LENGTH);

            if (hitNpc) {
              hitNpc.attack();
              // console.log('hit npc');
            }
          }
        };
        render.on('update', _update);

        grabbable[dataSymbol] = {
          cleanup: () => {
            grabbable.removeListener('grab', _grab);
            grabbable.removeListener('release', _release);

            render.removeListener('update', _update);
          },
        };
      },
      itemRemovedCallback(grabbable) {
        const {[dataSymbol]: {cleanup}} = grabbable;
        cleanup();

        delete grabbable[dataSymbol];
      },
    };
    items.registerItem(this, swordApi);

    const swordRecipe = {
      output: 'ITEM.STONE',
      width: 1,
      height: 3,
      input: [
        'ITEM.STONE',
        'ITEM.STONE',
        'ITEM.WOOD',
      ],
    };
    items.registerRecipe(this, swordRecipe);

    return () => {
      elements.destroyListener(elementListener);

      items.unregisterItem(this, swordApi);
      items.unregisterRecipe(this, swordRecipe);
    };
  };
};

module.exports = sword;