const indev = require('indev');

class Planet {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {three: {THREE, scene, camera}, render, utils: {random: randomUtils}} = zeo;
    const {alea} = randomUtils;

    const rng = new alea('zeo');
    const generator = indev({
      random: rng,
    });
    const elevationNoise = generator.uniform({
      frequency: 0.03,
      octaves: 8,
    });

    const size = 50;
    const width = size;
    const height = size;
    const depth = size;
    const _sum = v => v.x + v.y + v.z;
    const _makeSideGenerator = ({normal, u, v, uv}) => {
      const heightmap = new Float32Array(size * size);
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const index = i + (j * size);
          heightmap[index] = elevationNoise.in2D((uv.x * size) + i, (uv.y * size) + j) * 20;
        }
      }

      return (x, y, z) => {
        const vector = new THREE.Vector3(x, y, z);
        const length = vector.length();

        if (length > 0) {
          const angle = vector.angleTo(normal);
          const angleFactor = 1 - (angle / Math.PI);
          const uValue = _sum(u.clone().multiply(vector)) + (size / 2);
          const vValue = _sum(v.clone().multiply(vector)) + (size / 2);
          const index = uValue + (vValue * size);
          const heightValue = heightmap[index];
          const insideOutsideValue = (length <= heightValue ? -1 : 1);
          const etherValue = insideOutsideValue * angleFactor;
          return etherValue;
        } else {
          return -1;
        }
      };
    };

    const sideGenerators = [
      _makeSideGenerator({ // front
        normal: new THREE.Vector3(0, 0, 1),
        u: new THREE.Vector3(1, 0, 0),
        v: new THREE.Vector3(0, 1, 0),
        uv: new THREE.Vector2(0, 0),
      }),
      _makeSideGenerator({ // top
        normal: new THREE.Vector3(0, 1, 0),
        u: new THREE.Vector3(1, 0, 0),
        v: new THREE.Vector3(0, 0, 1),
        uv: new THREE.Vector2(0, -1),
      }),
      _makeSideGenerator({ // bottom
        normal: new THREE.Vector3(0, -1, 0),
        u: new THREE.Vector3(1, 0, 0),
        v: new THREE.Vector3(0, 0, 1),
        uv: new THREE.Vector2(0, 1),
      }),
      _makeSideGenerator({ // left
        normal: new THREE.Vector3(-1, 0, 0),
        u: new THREE.Vector3(0, 0, 1),
        v: new THREE.Vector3(0, 1, 0),
        uv: new THREE.Vector2(-1, 0),
      }),
      _makeSideGenerator({ // right
        normal: new THREE.Vector3(1, 0, 0),
        u: new THREE.Vector3(0, 0, 1),
        v: new THREE.Vector3(0, 1, 0),
        uv: new THREE.Vector2(1, 0),
      }),
      _makeSideGenerator({ // back
        normal: new THREE.Vector3(0, 0, -1),
        u: new THREE.Vector3(1, 0, 0),
        v: new THREE.Vector3(0, 1, 0),
        uv: new THREE.Vector2(2, 0),
      }),
    ];

    const cleanups = [];
    this._cleanup = () => {
      for (let i = 0; i < cleanups.length; i++) {
        const cleanup = cleanups[i];
        cleanup();
      }
    };

    let live = true;
    cleanups.push(() => {
      live = false;
    });

    const planetMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      shading: THREE.FlatShading,
    });
    cleanups.push(() => {
      planetMaterial.dispose();
    });

    const _requestMarchingCubes = () => {
      const _getCoordIndex = (x, y, z) => x + (y * width) + (z * width * height);
      const body = (() => {
        const result = new Uint8Array((3 * 4) + (width * height * depth * 4));

        new Uint32Array(result.buffer, 4 * 0, 4 * 1, 1)[0] = width;
        new Uint32Array(result.buffer, 4 * 1, 4 * 2, 1)[0] = height;
        new Uint32Array(result.buffer, 4 * 2, 4 * 3, 1)[0] = depth;

        const data = new Float32Array(result.buffer, 3 * 4);
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            for (let z = 0; z < depth; z++) {
              const index = _getCoordIndex(x, y, z);
              const dx = x - (width / 2);
              const dy = y - (height / 2);
              const dz = z - (depth / 2);

              let v = 0;
              for (let i = 0; i < sideGenerators.length; i++) {
                v += sideGenerators[i](dx, dy, dz);
              }
              data[index] = v;
            }
          }
        }

        return result;
      })();

      return fetch('/archae/planet/marchingcubes', {
        method: 'POST',
        body: body,
      })
        .then(res => res.arrayBuffer())
        .then(marchingCubesBuffer => {
          const marchingCubesArray = new Uint8Array(marchingCubesBuffer);
          const numPositions = new Uint32Array(marchingCubesBuffer, 4 * 0, 1)[0];
          const numNormals = new Uint32Array(marchingCubesBuffer, 4 * 1, 1)[0];
          const positions = new Float32Array(marchingCubesBuffer, 2 * 4, numPositions);
          const normals = new Float32Array(marchingCubesBuffer, (2 * 4) + (numPositions * 4), numNormals);
          return {
            positions,
            normals,
          };
        });
    };

    return _requestMarchingCubes()
      .then(marchingCubes => {
        if (live) {
          const planetMesh = (() => {
            const {positions, normals} = marchingCubes;

            const geometry = (() => {
              const geometry = new THREE.BufferGeometry();
              geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
              geometry.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
              return geometry;
            })();
            const material = planetMaterial;

            const mesh = new THREE.Mesh(geometry, material);
            return mesh;
          })();
          scene.add(planetMesh);

          cleanups.push(() => {
            scene.remove(planetMesh);
          });
        }
      });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Planet;
