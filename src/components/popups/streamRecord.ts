import PopupElement from '.';
import Button from '../button';
import CheckboxField from '../checkboxField';
import InputField from '../inputField';
import Row from '../row';

export default class PopupStreamRecord extends PopupElement<{}> {
  public titleInput: InputField;
  private recordVideoRow: Row;
  private previewContainer: HTMLElement;
  private previewAudioEl: HTMLElement;
  private previewVideoLandscapeEl: HTMLElement;
  private previewVideoPortraitEl: HTMLElement;
  private previewDescriptionEl: HTMLElement;

  public isVideoRecording: boolean = false;
  public isPortraitVideo: boolean = false;
  public isConfirmed: boolean = false;
  constructor(options: {
  }) {
    super('popup-stream-record', {
      body: true,
      title: true,
      closable: true
    });

    this.title.textContent = 'Start Recording';
    this.titleInput = new InputField({plainText: true, labelText: 'Recording Title'});

    const descriptionEl = document.createElement('div');
    descriptionEl.className = 'stream-record__description';
    descriptionEl.innerHTML = 'Record this stream and save the result into an file?<br/><br/>Participants will see that the chat is being recorded.';

    this.recordVideoRow = new Row({
      icon: 'videocamera',
      title: 'Also Record Video',
      checkboxField: new CheckboxField({
        listenerSetter: this.listenerSetter,
        toggle: true
      }),
      listenerSetter: this.listenerSetter
    });

    this.previewContainer = document.createElement('div');
    this.previewContainer.className = 'stream-record__preview';

    this.previewAudioEl = document.createElement('div');
    this.previewAudioEl.classList.add('stream-record__preview-audio');

    this.previewVideoLandscapeEl = document.createElement('div');
    this.previewVideoLandscapeEl.classList.add('stream-record__preview-video', 'is-landscape', 'hide', 'is-active');
    this.previewVideoPortraitEl = document.createElement('div');
    this.previewVideoPortraitEl.classList.add('stream-record__preview-video', 'is-portrait', 'hide');

    this.previewDescriptionEl = document.createElement('div');
    this.previewDescriptionEl.classList.add('stream-record__preview-description');
    this.previewDescriptionEl.textContent = 'This chat will be recorded into an audio file';

    this.previewContainer.append(this.previewAudioEl, this.previewVideoLandscapeEl, this.previewVideoPortraitEl, this.previewDescriptionEl);

    const confirmBtn = Button('stream-record__confirm-btn btn-primary');
    confirmBtn.textContent = 'START RECORDING';

    this.listenerSetter.add(this.recordVideoRow.checkboxField.input)('change', () => {
      this.isVideoRecording = this.recordVideoRow.checkboxField.input.checked;
      this.previewDescriptionEl.textContent = this.isVideoRecording ? 'Choose video orientation' : 'This chat will be recorded into an audio file';
      this.previewAudioEl.classList.toggle('hide', this.isVideoRecording);
      this.previewVideoLandscapeEl.classList.toggle('hide', !this.isVideoRecording);
      this.previewVideoPortraitEl.classList.toggle('hide', !this.isVideoRecording);
    });

    this.listenerSetter.add(this.previewVideoLandscapeEl)('click', () => {
      this.isPortraitVideo = false;
      this.previewVideoLandscapeEl.classList.toggle('is-active', !this.isPortraitVideo);
      this.previewVideoPortraitEl.classList.toggle('is-active', this.isPortraitVideo);
    });

    this.listenerSetter.add(this.previewVideoPortraitEl)('click', () => {
      this.isPortraitVideo = true;
      this.previewVideoLandscapeEl.classList.toggle('is-active', !this.isPortraitVideo);
      this.previewVideoPortraitEl.classList.toggle('is-active', this.isPortraitVideo);
    });

    this.listenerSetter.add(confirmBtn)('click', () => {
      this.isConfirmed = true;
      this.hide();
    });

    this.body.append(this.titleInput.container, descriptionEl, this.recordVideoRow.container, this.previewContainer, confirmBtn);
  }
}
