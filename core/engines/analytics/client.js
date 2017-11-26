class Analytics {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
     const {
      metadata: {
        server: {
          name: serverName,
          url: serverUrl,
        },
      },
    } = archae;

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

    const _parseUrlSpec = url => {
      const match = url.match(/^(?:([^:]+):\/\/)([^:]+)(?::([0-9]*?))?$/);
      return match && {
        protocol: match[1],
        host: match[2],
        port: match[3] ? parseInt(match[3], 10) : null,
      };
    };

    return archae.requestPlugins([
      '/core/utils/network-utils',
    ]).then(([
      networkUtils,
    ]) => {
      if (live) {
        const {AutoWs} = networkUtils;

        const modSpecs = [];

        const {port} = _parseUrlSpec(serverUrl);
        const ws = new AutoWs(`wss://my-site.zeovr.io/analytics/mods?name=${serverName}&port=${port}`);
        let needsUpdate = true;
        ws.on('connect', () => {
          if (needsUpdate) {
            for (let i = 0; i < modSpecs.length; i++) {
              _sendAdd(modSpecs[i]);
            }

            needsUpdate = false;
          }
        });
        ws.on('disconnect', () => {
          needsUpdate = true;
        });
        ws.on('error', err => {
          console.warn(err);
        });

        const heartbeatMessage = JSON.stringify({
          method: 'heartbeat',
          args: {},
        });
        const interval = setInterval(() => {
          ws.send(heartbeatMessage);
        }, 10 * 1000);
        cleanups.push(() => {
          clearInterval(interval);
        });

        const _sendAdd = modSpec => {
          const {id, name, version} = modSpec;
          ws.send(JSON.stringify({
            method: 'add',
            args: {
              id,
              name,
              version,
            },
          }));
        };
        const _sendRemove = modSpec => {
          const {id} = modSpec;
          ws.send(JSON.stringify({
            method: 'remove',
            args: {
              id,
            },
          }));
        };

        const analyticsApi = {
          add(modSpec) {
            modSpecs.push(modSpec);

            _sendAdd(modSpec);
          },
          remove(modSpec) {
            const index = modSpecs.findIndex(ms => ms.id === modSpec.id);
            if (index !== -1) {
              modSpecs.splice(index, 1);
            }

            _sendRemove(modSpec);
          }
        };
        return analyticsApi;
      }
    });
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Analytics;
