import PopupElement from '.';
import {copyTextToClipboard} from '../../helpers/clipboard';
import Button from '../button';
import ButtonIcon from '../buttonIcon';
import ButtonMenuToggle from '../buttonMenuToggle';
import confirmationPopup from '../confirmationPopup';
import Icon from '../icon';
import Row from '../row';

export default class PopupStreamSettings extends PopupElement<{}> {
  private serverUrlRow: Row;
  private streamKeyRow: Row;
  private revokeKeyRow: Row;

  public peerId: number;
  public serverUrl: string;
  public streamKey: string;
  private isRunning: boolean;
  private isStreamKeyMasked: boolean = true;
  public action: string; // This is kinda stupid way to pass 'result' of this popup, but I don't to waste time on proper cb
  constructor(options: {
    peerId: number,
    serverUrl: string,
    streamKey: string,
    isRunning: boolean
  }) {
    super('popup-stream-settings', {
      body: true,
      title: true,
      closable: true
    });

    this.peerId = options.peerId;
    this.serverUrl = options.serverUrl;
    this.streamKey = options.streamKey;
    this.isRunning = options.isRunning;

    this.title.textContent = 'Stream Settings';

    const descriptionEl = document.createElement('div');
    descriptionEl.className = 'stream-settings__description';
    descriptionEl.innerHTML = 'To stream video with another app, enter these Server URL and Stream Key in your streaming app. Software encoding recommended (×264 in OBS).';

    this.serverUrlRow = new Row({
      icon: 'link',
      title: 'rtmps://dc4-1.rtmp.t.me/s/',
      subtitle: 'Server URL',
      buttonRight: ButtonIcon('copy', {noRipple: true}),
      listenerSetter: this.listenerSetter
    });
    this.serverUrlRow.container.classList.add('stream-settings__server-url-row');

    this.streamKeyRow = new Row({
      icon: 'lock',
      title: '••••••••••••••••••••',
      subtitle: 'Stream Key',
      buttonRight: ButtonIcon('copy', {noRipple: true}),
      listenerSetter: this.listenerSetter
    });
    this.streamKeyRow.container.classList.add('stream-settings__stream-key-row', 'is-masked');
    this.body.append(descriptionEl, this.serverUrlRow.container, this.streamKeyRow.container);

    if(this.isRunning) {
      this.revokeKeyRow = new Row({
        icon: 'rotate_left',
        title: 'Revoke Stream Key',
        clickable: this.onRevokeClick,
        listenerSetter: this.listenerSetter
      });
      this.revokeKeyRow.container.classList.add('danger');
      this.body.append(this.revokeKeyRow.container);
    }

    const showIcon = Icon('eye1');
    this.streamKeyRow.subtitle.append(showIcon);

    const infoEl = document.createElement('div');
    infoEl.className = 'stream-settings__info';
    infoEl.innerHTML = 'Once you start broadcasting in your streaming app, click Start Streaming below.';

    if(this.isRunning) {
      const endBtn = Button('stream-settings__confirm-btn btn-primary danger');
      endBtn.textContent = 'END STREAM';
      this.body.append(endBtn);

      this.listenerSetter.add(endBtn)('click', async() => {
        // Confirm
        await confirmationPopup({
          title: 'End Video Stream',
          description: 'Are you sure you want to end stream?',
          button: {
            langKey: 'OK',
            isDanger: true
          }
        });
        this.action = 'end';
        this.hide();
      });
    } else {
      const confirmBtn = Button('stream-settings__confirm-btn btn-primary');
      confirmBtn.textContent = 'START STREAMING';
      this.body.append(infoEl, confirmBtn);

      this.listenerSetter.add(confirmBtn)('click', async() => {
        this.action = 'start';
        this.hide();
      });
    }

    const btnMenu = ButtonMenuToggle({
      listenerSetter: this.listenerSetter,
      direction: 'bottom-left',
      buttons: [{
        icon: 'rotate_left',
        regularText: 'Revoke Stream Key',
        onClick: this.onRevokeClick
      }]
    });
    this.header.append(btnMenu);

    this.listenerSetter.add(this.serverUrlRow.buttonRight)('click', () => copyTextToClipboard(this.serverUrl));
    this.listenerSetter.add(this.streamKeyRow.buttonRight)('click', () => copyTextToClipboard(this.streamKey));
    this.listenerSetter.add(showIcon)('click', () => {
      this.isStreamKeyMasked = !this.isStreamKeyMasked;
      this.streamKeyRow.container.classList.toggle('is-masked', this.isStreamKeyMasked);
      this.streamKeyRow.title.textContent = this.isStreamKeyMasked ? '••••••••••••••••••••' : this.streamKey;
    });
  }

  private onRevokeClick = async() => {
    await confirmationPopup({
      title: 'Revoke Stream Key',
      description: 'Are you sure you want to revoke current stream key?',
      button: {
        langKey: 'OK',
        isDanger: true
      }
    });

    this.managers.apiManager.invokeApi('phone.getGroupCallStreamRtmpUrl', {
      peer: await this.managers.appPeersManager.getInputPeerById(this.peerId),
      revoke: true
    }).then((settings) => {
      this.serverUrl = settings.url;
      this.streamKey = settings.key;

      this.isStreamKeyMasked = true; // Reset masked status to prevent instantly spoilering new key
      this.serverUrlRow.title.textContent = this.serverUrl;
      this.streamKeyRow.title.textContent = '••••••••••••••••••••';
    });
  }
}
