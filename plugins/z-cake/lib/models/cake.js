const numSlices = 8;
const layerSpecs = [
  {
    color: 0x333333,
  },
  {
    color: 0xFFFFFF,
  },
  {
    color: 0x333333,
  },
  {
    color: 0xFFFFFF,
  },
  {
    color: 0x333333,
  },
];
const numLayers = layerSpecs.length;
const layerSize = 0.2;
const layerHeight = 0.03;

function CakeModel({
  THREE,
  slices = 0,
}) {
  const object = new THREE.Object3D();

  const layersMesh = (() => {
    const object = new THREE.Object3D();

    for (let i = 0; i < numLayers; i++) {
      const layerSpec = layerSpecs[i];
      const {color} = layerSpec;
      
      const geometry = new THREE.CylinderBufferGeometry(layerSize, layerSize, layerHeight, numSlices, 1, false, 0, (Math.PI * 2) * (slices / numSlices));
      geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, (layerHeight * ((layerSpecs.length - 1) / 2)) - (i * layerHeight), 0));
      const material = new THREE.MeshPhongMaterial({
        color: color,
        side: THREE.DoubleSide,
      });

      const layerMesh = new THREE.Mesh(geometry, material);
      object.add(layerMesh);
    }

    return object;
  })();
  object.add(layersMesh);

  const cherrySize = 0.02;
  const cherryRaidus = 0.125;

  const cherriesMesh = (() => {
    const object = new THREE.Object3D();

    const cherryMaterial = new THREE.MeshPhongMaterial({
      color: 0xE91E63,
      shininess: 0,
      shading: THREE.FlatShading,
    });

    for (let i = 0; i < numSlices; i++) {
      if (i >= slices) {
        continue;
      }

      const geometry = new THREE.SphereBufferGeometry(cherrySize, 5, 5);
      const angle = (i / numSlices) * (Math.PI * 2);
      geometry.applyMatrix(new THREE.Matrix4().makeTranslation(
        Math.sin(angle) * cherryRaidus,
        (((layerSpecs.length - 1) / 2) * layerHeight) + (cherrySize * 1.5),
        Math.cos(angle) * cherryRaidus
      ));
      geometry.applyMatrix(new THREE.Matrix4().makeRotationY(((1 / numSlices) * 0.5) * (Math.PI * 2)));
      const material = cherryMaterial;

      const cherryMesh = new THREE.Mesh(geometry, material);
      object.add(cherryMesh);
    }

    return object;
  })();
  object.add(cherriesMesh);

  return object;
}

CakeModel.numSlices = numSlices;
CakeModel.layerSpecs = layerSpecs;
CakeModel.numLayers = numLayers;
CakeModel.layerSize = layerSize;
CakeModel.layerHeight = layerHeight;

module.exports = CakeModel;
