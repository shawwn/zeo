class Test {
  mount() {
    const {elements, input, payment} = zeo;

    console.log('mount');

    const testComponent = {
      selector: 'test[position]',
      attributes: {
        position: {
          type: 'matrix',
          value: [
            0, 0, 0,
            0, 0, 0, 1,
            1, 1, 1
          ]
        },
        text: {
          type: 'text',
          value: 'Some text',
        },
        number: {
          type: 'number',
          value: 1,
          min: 0,
          max: 10,
          step: 1,
        },
        select: {
          type: 'select',
          value: 'Option A',
          options: [
            'Option A',
            'Option B',
          ],
        },
        color: {
          type: 'color',
          value: '#E91E63',
        },
        checkbox: {
          type: 'checkbox',
          value: false,
        },
        file: {
          type: 'file',
          value: 'https://lol.com',
        },
      },
      entityAddedCallback(entityElement, attribute, value) {
        console.log('entityAddedCallback', {entityElement, attribute, value});
      },
      entityRemovedCallback(entityElement) {
        console.log('entityRemovedCallback', {entityElement});
      },
      entityAttributeValueChangedCallback(entityElement, name, oldValue, newValue) {
        console.log('entityAttributeValueChangedCallback', {entityElement, name, oldValue, newValue});
      },
    };
    elements.registerComponent(this, testComponent);

    const keypress = e => {
      if (e.keyCode === 98) { // B
        payment.requestBuy({
          srcAsset: 'CRAPCOIN',
          srcQuantity: 10,
          dstAsset: 'CRAPCOINB',
          dstQuantity: 1,
        })
          .then(result => {
            console.warn('buy result', result);
          })
          .catch(err => {
            console.warn('buy error', err);
          });
      } else if (e.keyCode === 112) { // P
        payment.requestPay({
          address: 'n3W1ExUh7Somt28Qe7DT5FUfY127MY4r1X',
          asset: 'CRAPCOIN',
          quantity: 10,
        })
          .then(result => {
            console.warn('pay result', result);
          })
          .catch(err => {
            console.warn('pay error', err);
          });
      }
    };
    input.on('keypress', keypress);

    this._cleanup = () => {
      elements.unregisterComponent(this, testComponent);

      input.removeListener('keypress', keypress);
    };
  }

  unmount() {
    console.log('unmount');

    this._cleanup();
  }
}

module.exports = Test;