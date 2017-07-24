const protocolUtils = require('./lib/utils/protocol-utils');

class Hand {
  constructor(archae) {
    this._archae = archae;
  }

  mount() {
    const {_archae: archae} = this;
    const {app, wss} = archae.getCore();

    class Grabbable {
      constructor(n, position, rotation, scale, localPosition, localRotation, localScale) {
        this.n = n;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.localPosition = localPosition;
        this.localRotation = localRotation;
        this.localScale = localScale;

        this.userId = null;
        this.side = null;
      }

      grab(userId, side) {
        const {n} = this;

        this.userId = userId;
        this.side = side;
      }

      release() {
        const {userId} = this;

        if (userId !== null) {
          const {n, side} = this;

          this.userId = null;
          this.side = null;

          return {
            userId,
            side,
          };
        } else {
          return null;
        }
      }

      setState(position, rotation, scale, localPosition, localRotation, localScale) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.localPosition = localPosition;
        this.localRotation = localRotation;
        this.localScale = localScale;
      }
    }

    const grabbables = {};
    const interests = {};

    const connections = [];

    wss.on('connection', c => {
      const {url} = c.upgradeReq;

      let match;
      if (match = url.match(/\/archae\/handWs\?id=(.+)$/)) {
        const userId = match[1];
        c.userId = userId;

        const buffer = new ArrayBuffer(protocolUtils.BUFFER_SIZE);

        const _sendObject = (type, args) => {
          const e = {
            type,
            args,
          };
          const es = JSON.stringify(e);

          c.send(es);
        };
        const _sendBuffer = buffer => {
          c.send(buffer);
        };
        const _broadcastObject = (interestId, type, args) => {
          if (connections.some(connection => connection !== c)) {
            const e = {
              type,
              args,
            };
            const es = JSON.stringify(e);

            const interest = interests[interestId];
            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              const {userId} = connection;
              if (interest.includes(userId) && connection !== c) {
                connection.send(es);
              }
            }
          }
        };
        const _broadcastBuffer = (interestId, buffer) => {
          if (connections.some(connection => connection !== c)) {
            const interest = interests[interestId];

            for (let i = 0; i < connections.length; i++) {
              const connection = connections[i];
              const {userId} = connection;
              if (interest.includes(userId) && connection !== c) {
                connection.send(buffer);
              }
            }
          }
        };

        const localInterests = [];

        c.on('message', o => {
          if (typeof o === 'string') {
            const m = JSON.parse(o);

            if (typeof m === 'object' && m !== null && typeof m.method === 'string' && Array.isArray(m.args)) {
              const {method, args} = m;

              if (method === 'addGrabbable') {
                const [n, position, rotation, scale, localPosition, localRotation, localScale] = args;

                const grabbable = grabbables[n];
                if (!grabbable) {
                  const newGrabbable = new Grabbable(n, position, rotation, scale, localPosition, localRotation, localScale);
                  grabbables[n] = newGrabbable;
                }

                let interest = interests[n];
                if (!interest) {
                  interest = [];
                  interests[n] = interest;
                }
                if (!interest.includes(userId)) {
                  interest.push(userId);
                }

                if (!localInterests.includes(n)) {
                  localInterests.push(n);
                }

                if (grabbable) {
                  const {userId, side} = grabbable;
                  if (userId) {
                    _sendObject('grab', [n, userId, side]);
                  }

                  const {position, rotation, scale, localPosition, localRotation, localScale} = grabbable;
                  _sendBuffer(protocolUtils.stringifyUpdate(n, position, rotation, scale, localPosition, localRotation, localScale, buffer, 0));
                }
              } else if (method === 'removeGrabbable') {
                const [n] = args;

                const grabbable = grabbables[n];

                if (grabbable) {
                  const releaseSpec = grabbable.release();
                  if (releaseSpec) {
                    const {userId, side} = releaseSpec;
                    _broadcastObject(n, 'release', [n]);
                  }

                  _broadcastObject(n, 'destroy', [n]);

                  delete grabbables[n];
                  delete interests[n];

                  localInterests.splice(localInterests.indexOf(n), 1);
                }
              } else if (method === 'grab') {
                const [n, side] = args;

                const grabbable = grabbables[n];

                if (grabbable) {
                  const releaseSpec = grabbable.release();
                  if (releaseSpec) {
                    const {userId, side} = releaseSpec;
                    _broadcastObject(n, 'release', [n]);
                  }

                  grabbable.grab(userId, side);
                  _broadcastObject(n, 'grab', [n, userId, side]);
                }
              } else if (method === 'release') {
                const [n] = args;

                const grabbable = grabbables[n];

                if (grabbable) {
                  const releaseSpec = grabbable.release();
                  if (releaseSpec) {
                    const {userId, side} = releaseSpec;
                    _broadcastObject(n, 'release', [n]);
                  }
                }
              } else {
                console.warn('no such hand method:' + JSON.stringify(method));
              }
            } else {
              console.warn('invalid message', m);
            }
          } else {
            const {n, position, rotation, scale, localPosition, localRotation, localScale} = protocolUtils.parseUpdate(o.buffer);
            const grabbable = grabbables[n];

            if (grabbable) {
              grabbable.setState(position, rotation, scale, localPosition, localRotation, localScale);
              _broadcastBuffer(n, o);
            }
          }
        });

        connections.push(c);

        c.on('close', () => {
          for (let i = 0; i < localInterests.length; i++) {
            const n = localInterests[i];
            const interest = interests[n];

            interest.splice(interest.indexOf(userId), 1);
            if (interest.length === 0) {
              delete interests[n];
            }
          }

          connections.splice(connections.indexOf(c), 1);
        });
      }
    });

    this._cleanup = () => {
      for (let i = 0; i < connections.length; i++) {
        const connection = connections[i];
        connection.close();
      }
    };
  }

  unmount() {
    this._cleanup();
  }
}

module.exports = Hand;
