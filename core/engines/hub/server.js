const path = require('path');
const fs = require('fs');

const psNode = require('ps-node');

const _resolvePath = (file, directory) => path.normalize(/^\//.test(file) ? file : path.join(directory, file))
const localIndexFilePath = _resolvePath(process.argv[1], process.cwd());

class Hub {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const hubImgStatic = express.static(path.join(__dirname, 'lib', 'img'));
    function serveHubImg(req, res, next) {
      hubImgStatic(req, res, next);
    }
    app.use('/archae/hub/img', serveHubImg);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (route.handle.name === 'serveHubImg') {
          routes.splice(i, 1);
        }
        if (route.route) {
          route.route.stack.forEach(removeMiddlewares);
        }
      }
      app._router.stack.forEach(removeMiddlewares);
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Hub;
