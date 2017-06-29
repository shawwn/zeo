const path = require('path');

class Assets {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {express, app} = archae.getCore();

    const controllerjsModelPath = path.join(path.dirname(require.resolve('controllerjs')), 'model');

    const assetsHmdStatic = express.static(path.join(__dirname, 'lib', 'models', 'hmd'));
    function serveAssetsHmd(req, res, next) {
      assetsHmdStatic(req, res, next);
    }
    app.use('/archae/assets/models/hmd', serveAssetsHmd);
    const assetsControllerStatic = express.static(controllerjsModelPath);
    function serveAssetsController(req, res, next) {
      assetsControllerStatic(req, res, next);
    }
    app.use('/archae/assets/models/controller', serveAssetsController);

    this._cleanup = () => {
      function removeMiddlewares(route, i, routes) {
        if (
          route.handle.name === 'serveAssetsHmd' ||
          route.handle.name === 'serveAssetsController'
        ) {
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

module.exports = Assets;
