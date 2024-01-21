import PopupElement from '.';
import RadioField from '../radioField';
import Row, {RadioFormFromRows} from '../row';

export default class PopupStreamOutputDevice extends PopupElement<{}> {
  currentId: string;
  deviceRows: Row[];

  constructor(options: {
    currentId: string
  }) {
    super('popup-stream-output-device', {
      body: true,
      title: true,
      buttons: [{
        langKey: 'OK',
        isCancel: true
      }]
    });

    this.title.textContent = 'Output Device';
    this.currentId = options.currentId;
    this.build();
  }

  async build() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(device => device.kind === 'audiooutput');

    this.deviceRows = [];
    for(const device of audioDevices) {
      const row = new Row({
        radioField: new RadioField({
          text: device.label,
          name: 'output-device',
          value: device.deviceId
        })
      });
      row.radioField.checked = device.deviceId == this.currentId;
      this.deviceRows.push(row);
    }

    const form = RadioFormFromRows(this.deviceRows, (value) => {
      this.currentId = value;
    });
    this.body.append(form);
  }
}
