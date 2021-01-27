import {
  Component,
  Optional,
  Inject,
  Input,
  ViewChild,
  OnInit,
  OnDestroy, ElementRef, NgZone, ChangeDetectorRef
} from '@angular/core';

import {
  NgModel,
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  NG_ASYNC_VALIDATORS, FormControl,
} from '@angular/forms';

import { Observable } from 'rxjs/Observable';
import { ElementBase } from '../../../form';
import { IqSelect2Item } from 'ng2-iq-select2';
import { DynamicFormService, DataService, ModalsService, ToastService, RolesService } from '../../../shared/services';
import createNumberMask from 'text-mask-addons/dist/createNumberMask';
import * as _ from 'underscore';
import {IMyDpOptions, IMyInputFocusBlur} from 'mydatepicker';
import { AgmCoreModule, MapsAPILoader } from '@agm/core';
import { } from 'googlemaps';
import {ReplaySubject} from 'rxjs/ReplaySubject';



@Component({
  selector: 'app-tab',
  styleUrls: ['./tab.component.scss'],
  templateUrl: './tab.component.html',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: TabComponent,
    multi: true,
  }],
})

export class TabComponent extends ElementBase<string> implements OnInit, OnDestroy {
  @Input() private validationData: any;
  @ViewChild(NgModel) model: NgModel;
  @ViewChild('video') video;
  @ViewChild('search')
  @ViewChild('uploadableFiles') uploadableFiles: any;
  public searchElementRef: ElementRef;
  public needHideVideo: boolean = true;
  // Todo remove to another place
  private selectNoResultMsg = 'Нет доступных результатов';
  private _activeSections: any;
  private videoStream: any;
  public showLoaderCardRead: boolean = false;
  public userSmsVerificationCode: any;

  public mask = createNumberMask({
    thousandsSeparatorSymbol: ' ',
    allowDecimal: true,
    allowNegative: true,
    prefix: '',
    suffix: ''
  });
  private autocomplete: any;
  private datePickerOptions = [];

  private myDatePickerOptions: IMyDpOptions = {
    dateFormat: 'dd.mm.yyyy',
    sunHighlight: false,
    height: '17px',
    width: '161px',
    showTodayBtn: false,
    selectorWidth: '260px',
    selectorHeight: '295px',
    monthLabels: { 1: 'ЯНВ', 2: 'ФЕВР', 3: 'МАРТ', 4: 'АПР', 5: 'МАЙ', 6: 'ИЮНЬ', 7: 'ИЮЛЬ', 8: 'АВГ', 9: 'СЕНТ', 10: 'ОКТ', 11: 'НОЯБ', 12: 'ДЕК' },
    dayLabels: {su: 'ВС', mo: 'ПН', tu: 'ВТ', we: 'СР', th: 'ЧТ', fr: 'ПТ', sa: 'СБ'},
  };
  public host: any;
  public uploadFormsList = [];

  public bankDocumentList = {};
  public uploadedFileList: any;
  public uploadPdfFileName: '';

  constructor(
    @Optional() @Inject(NG_VALIDATORS) validators: Array<any>,
    @Optional() @Inject(NG_ASYNC_VALIDATORS) asyncValidators: Array<any>,
    private dynamicFormService: DynamicFormService,
    private dataService: DataService,
    private modalService: ModalsService,
    private toastService: ToastService,
    private mapsAPILoader: MapsAPILoader,
    private ngZone: NgZone,
    private ref: ChangeDetectorRef,
    private rolesService: RolesService
  ) {
    super(validators, asyncValidators);
  }

  ngOnInit() {
    this.dynamicFormService.event.subscribe(message => {
      if(message.name === 'check') {
        this.dynamicFormService.hideSelectsBeforGetValues = false;
      }
    });

    this.host = this.dataService.getHost();
  }

  // Don't work when change query params
  ngOnDestroy() {}

  @Input()
  set activeSections(activeSections: any) {
    if(activeSections && Object.keys(activeSections).length === 0) {
      return;
    }
    this._activeSections = activeSections;
    this.dynamicFormService.buildFieldDependenciesAndGetSelectsData(activeSections);
    _.each(activeSections, (section) => {
      _.each(section.Questions, question => {
        if (question.Type === 'Photo') {
          question.needHideVideo = true;
        }
        if (question.Type === 'Upload') {
          _.each(question.UploadForms, (uploadDoc) => {
            uploadDoc.needHideVideo = true
          })
          this.uploadFormsList = question.UploadForms;
          this.getUploadedFilesList();
        }
      })
    })
    if(_.find(activeSections[0].Questions, item => {
      return item.Type === 'AddressAutocomplete'
    })) {
      this.mapsAPILoader.load().then(() => {
        if (this.searchElementRef) {
          this.autocomplete = new google.maps.places.Autocomplete(this.searchElementRef.nativeElement, {
            types: ['address']
          });
        }
        this.autocomplete.addListener('place_changed', () => {
          this.ngZone.run(() => {
            //TODO: need use this method for put model in value
            // this.ourValidate(autocomplete.getPlace().formatted_address)
            // const place: google.maps.places.PlaceResult = autocomplete.getPlace();
            //
            // if (place.geometry === undefined || place.geometry === null) {
            //   return;
            // }
            //
            // this.latitude = place.geometry.location.lat();
            // this.longitude = place.geometry.location.lng();
            // this.zoom = 12;
          });
        });
      });
    }
  }

  get activeSections() {
    return this._activeSections;
  }
  get desktop(){
    if (window.matchMedia(`(min-width: 960px)`).matches ) {
      return true;
    } else {
      return false;
    }
  }
  get isDisabledForm() {
    return this.dynamicFormService.isDisabledForm;
  }

  get hideSelectsBeforGetValues() {
    return this.dynamicFormService.hideSelectsBeforGetValues;
  }
  getCallBackForAutoComplete(event, value, question) {
    this.autocomplete.addListener('place_changed', () => {
      console.log(this.autocomplete.getPlace().formatted_address)

      this.ourValidate(this.autocomplete.getPlace().formatted_address, value, question)
    });
    this.autocomplete.removeListener('place_changed')
  }
  getCallBackForDataSourceProvider(question, value) {
    return (pattern: string, dictName: string, maxResults?: number) => {
      if(question.QuestionData.Action) {
        return this.dataService.getListFromAction(question.QuestionData.Action, {searchTerm: pattern, pageSize: 40, pageNum: 1})
          .map(data => {
            return data.Results;
          });
      }

      const textAttribute = question.QuestionData.Text ? question.QuestionData.Text : 'Name';
      const formula = question.QuestionData['data-calculate-formula'];
      const valueForProductSelect = formula ? this.dynamicFormService.calculatedValueForInputThroughFormula(value, formula) : 0;
      return Observable.of(this.dynamicFormService.selectsData[dictName].active
        .filter((list) => {
            let isVariableInInterval = true;
            if(question.QuestionData && question.QuestionData['data-val-range-min-computed']) {
              isVariableInInterval = list[question.QuestionData['data-val-range-min-computed']] < valueForProductSelect && list[question.QuestionData['data-val-range-max-computed']] > valueForProductSelect;
            }
            return isVariableInInterval && list[textAttribute].toUpperCase().indexOf(pattern.toUpperCase()) !== -1;
          }
        ));
    };
  }

  getCallBackForIqSelect2ItemAdapter(question) {
    const textAttribute = question.QuestionData.Text ? question.QuestionData.Text : 'Name';
    const valueAttribute = question.QuestionData.Value ? question.QuestionData.Value : 'Id';

    return (entity: any) => {
      if(question.QuestionData.Action) {
        return {
          id: entity.id,
          text: entity.text,
          entity: entity
        };
      }

      return {
        id: entity[valueAttribute],
        text: entity[textAttribute],
        entity: entity
      };
    };
  }

  getCallBackForSelectedProvider(question, value) {
    const valueAttribute = question.QuestionData.Value ? question.QuestionData.Value : 'Id';
    return (ids: any[], name: string): Observable<any[]> => {
      if(question.QuestionData.Set && this.dynamicFormService.selectsData[name]) {
        const selectedItems: any[] = [];
        ids.forEach((element) => {
          const id = this.dynamicFormService.isObject(element) ? element.Id : element;
          this.dynamicFormService.selectsData[name].all
            .filter((item) => {
              if(!question.QuestionData.Multi && item[valueAttribute] === id) {
                value[question.Field] = item;
              }
              return item[valueAttribute] === id;
            })
            .map((item) => selectedItems.push(item));
        });
        return Observable.of(selectedItems);
      }

      // const id: any = ids[0];
      const id: any = this.dynamicFormService.isObject(ids[0]) ? ids[0].id : ids[0];
      return this.dataService.getDataFromAction(question.QuestionData.Action, id)
        .map(data => {
          return [data];
        });
    };
  }

  // uploadFiles(event, value, question) {
  //   const files = event.target.files;
  //   if (files.length > 0) {
  //     this.dynamicFormService.uploadFiles(files).subscribe(
  //       data => {
  //         let uploadedImages = [...value.Upload];
  //         for(let i = 0; i < data.files.length; i++) {
  //           uploadedImages.push({
  //             name: data.files[i].name,
  //             thumbnail_url: data.files[i].thumbnail_url,
  //             url: data.files[i].url,
  //           });
  //         }
  //         this.ourValidate(uploadedImages, value, question);
  //       }
  //     );
  //   }
  // }

  private onSelect(item: IqSelect2Item, value, question) {
    this.modelChangeInputNumber(value[question.Field], value, question);
  }

  private onRemove(item: IqSelect2Item, value, question) {
    if(typeof value[question.Field] === 'undefined') {
      return;
    }
    this.modelChangeInputNumber(value[question.Field], value, question);
  }

  private showQuestion(question, value) {
    return this.dynamicFormService.isShowElementInTabComponent(question, value);
  }

  trackByFn(index, question) {
    return index;
  }

  private getDatePickerOptions(question) {
    if(!this.datePickerOptions[question.Field]) {
      if (question.QuestionData && question.QuestionData['disallow-future-date']) {
        const date = new Date();
        // date.setDate(date.getDate());
        const copy = Object.assign({}, this.myDatePickerOptions);
        copy.disableSince = {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate() + 1
        };
        this.datePickerOptions[question.Field] = copy;
        return copy;
      }
      this.datePickerOptions[question.Field] = this.myDatePickerOptions;
      return this.myDatePickerOptions;
    } else {
      return this.datePickerOptions[question.Field]
    }
  }

  private calculateCreditAmount(value, question) {
    const functionName = question.QuestionData['function-name'];
    const [fieldName, amountFormula] = question.QuestionData['function-input'].split(';');
    const dataPostcalculateFormula = question.QuestionData['data-postcalculate-formula'];
    const resultField = question.QuestionData['ResultField'];

    if(!value[fieldName] || value[fieldName] === null) {
      this.toastService.toAstr('info', {message: 'Не все необходимые поля были заполнены!'});
      return false;
    }

    const questionValueId = this.dynamicFormService.getQuestionValueId(value[fieldName]);
    const amount = this.dynamicFormService.calculatedValueForInputThroughFormula(value, amountFormula);
    const dataPostcalculateValue = this.dynamicFormService.calculatedValueForInputThroughFormula(value, dataPostcalculateFormula);

    this.dataService.getValueFromServerByFunctionName(
      functionName,
      {
        ProductId: value[fieldName][questionValueId],
        Amount: amount
      }
    ).subscribe(data => {
      const result = data + dataPostcalculateValue;
      this.modelChangeInputNumber(result, value, this.dynamicFormService.questionsNameToQuestionsObject[resultField]);
    });
  }

  private getIntervalValueForInputNumber(attributeName, question, value) {
    if(Object.keys(value).length > 0 && question.QuestionData && question.QuestionData[`data-val-range-${attributeName}-computed`]) {
      const [fieldName, fieldPropery] =  question.QuestionData[`data-val-range-${attributeName}-computed`].split('.');
      const returnedInterval = value[fieldName] && value[fieldName][fieldPropery] ? value[fieldName][fieldPropery] : '';
      return returnedInterval;
    }
    // Todo Changed for JSON key in QuestionData
    if(question.Field === 'DayPay') {
      const limit = question.QuestionData[`data-val-range-${attributeName}`];
      return limit;
    }

    return;
  }

  private showCreditCalc(value) {
    if(value.ProductId === null) {
      this.toastService.toAstr('error', {message: 'Кредитный продукт не выбран!'});
      return false;
    }
    this.modalService.creditCalc('График погашения', value);
  }
  private readDocument(value: any, question: any) {
    this.showLoaderCardRead = true;
    this.dataService.getClientInfo()
      .subscribe(data => {
        this.showLoaderCardRead = false;
        if(question.QuestionData['data-val-set']) {
          this.setValuesFromRules(value, question);
        }
        if(question.QuestionData['data-set-mapping']) {
          this.setDataWithMapping(value, question, data);
        }
      }, error => {
        this.showLoaderCardRead = false;
      })
  }
  private getListOfProducts(value: any, question: any) {
    if(Array.isArray((value || [])[question.Field])) {
      const res = [];
      _.each((value || [])[question.Field], (index) => {
        const indexOfActiveField = _.findIndex(this.dynamicFormService.selectsData[question.QuestionData.Set].active, item => {
          return item.Id === index
        });
        if(indexOfActiveField >= 0) {
          res.push(this.dynamicFormService.selectsData[question.QuestionData.Set].active[indexOfActiveField].ListOfProducts)
        }
      })
      return res.length ? [].concat.apply([], res) : null;
    } else {
      return null;
    }
  }
  private setValuesFromRules(value: any, question: any) {
    const correctMapping =  Object.assign({}, ...(question.QuestionData['data-val-set']));
    _.each( correctMapping , (item, index) => {
      // if(index === 'MainDocumentByOrganizationType'){
      //   this.modelChangeInputNumber({Id: 0, IsActive: 1, Name: "Иной орган"}, value, this.dynamicFormService.questionsNameToQuestionsObject[index])
      // }else {
        this.modelChangeInputNumber(item, value, this.dynamicFormService.questionsNameToQuestionsObject[index]);
      // }
      })
  }


  private setDataWithMapping(value: any, question: any, data: any) {
    const correctMapping =  Object.assign({}, ...(question.QuestionData['data-set-mapping']));
    if(question.QuestionData['data-set-mapping-limit']) {
      data = data.slice(0, question.QuestionData['data-set-mapping-limit'])
    }
    _.each( correctMapping , (item, index) => {
      if(index === '_dev_allObject') {
        this.modelChangeInputNumber([], value, this.dynamicFormService.questionsNameToQuestionsObject[item]);
        _.each(data, (commercialInvoice, commercialInvoiceIndex) => {
          const existItem = _.find(this.dynamicFormService.selectsData[this.dynamicFormService.questionsNameToQuestionsObject[item].QuestionData.Set].all, (existingItem) => {
            return existingItem.Id === commercialInvoice.Id;
          });
          if (!existItem) {
            this.dynamicFormService.selectsData[this.dynamicFormService.questionsNameToQuestionsObject[item].QuestionData.Set].all.push(commercialInvoice);
          }
          if(this.dynamicFormService.selectsData[this.dynamicFormService.questionsNameToQuestionsObject[item].QuestionData.Set].active.length) {
            this.dynamicFormService.selectsData[this.dynamicFormService.questionsNameToQuestionsObject[item].QuestionData.Set].active.push(commercialInvoice)
          } else {
            this.dynamicFormService.selectsData[this.dynamicFormService.questionsNameToQuestionsObject[item].QuestionData.Set].active = new Array(commercialInvoice);
          }
          this.modelChangeInputNumber([].concat.apply([commercialInvoice.Id], [value.ConsumerCreditCommercialInvoices]), value, this.dynamicFormService.questionsNameToQuestionsObject[item]);
        })
      } else {
        if(Array.isArray(data)) {
          let res = 0;
          data.forEach((invoice) => {
            res += invoice[index];
          })
          this.modelChangeInputNumber(res, value, this.dynamicFormService.questionsNameToQuestionsObject[item]);
        } else {
          this.modelChangeInputNumber(data[index], value, this.dynamicFormService.questionsNameToQuestionsObject[item]);
        }
      }
    });
  }
  private logData(value: any, question: any) {
    // console.log(this.dynamicFormService.selectsData[question.QuestionData.Set].active[(value || [])[question.Field]].ListOfProducts);
  }
  private openClientSign(fieldValue: any, question: any) {
    this.modalService.clientSign().subscribe(
      result => {
        if(!result) return;
        this.ourValidate(result, fieldValue, question);
      }
    );
  }

  private openCartRead(value: any, question: any) {
    const requestedValues = {};
    const correctMapping = Object.assign({}, ...(question.QuestionData['data-set-input']));
    _.each(correctMapping, (item, index) => {
      if (typeof value[item] === 'object') {
        requestedValues[index] = value[item].Id;
      } else if((typeof value[item] === 'string' && value[item] !== '') || typeof value[item] === 'number') {
        requestedValues[index] = value[item]
      }
      // requestedValues[index] = typeof value[item] === 'object' ? value[item].Id : value[item];
    })
    // let nullValue = '';
    // for(const key in requestedValues) {
    //   if(requestedValues.hasOwnProperty(key)) {
    //     if(requestedValues[key] === '') {
    //       nullValue = correctMapping[key]
    //     }
    //   }
    // }
    // if(nullValue === '') {
      this.dataService.getInvoiceFromClientData(requestedValues)
        .subscribe(data => {
          if(data.length) {
            if (question.QuestionData['data-set-mapping']) {
              this.setDataWithMapping(value, question, data);
            }
          } else {
            const toAstrData = {
                  title: 'Внимание!',
                  message: 'Счет-фактуры не найдены',
                };
                this.toastService.toAstr('error', toAstrData);
          }
        })
    // } else {
    //   const toAstrData = {
    //     title: 'Внимание!',
    //     message: 'Поле ' + this.dynamicFormService.questionsNameToQuestionsObject[nullValue].Display + ' не заполнено',
    //   };
    //   this.toastService.toAstr('error', toAstrData);
    // }
  }

  private showVideo(needClose: boolean, question: any) {
    if(!needClose) {
      question.needHideVideo = false;
      // Get access to the camera!
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const video = <HTMLVideoElement>document.getElementById('video-' + question.Field);
        // Not adding `{ audio: true }` since we only want video now
        navigator.mediaDevices.getUserMedia({video: true}).then((stream) => {
          this.videoStream = stream;
          try {
            video.srcObject = stream;
          } catch (error) {
            video.src = URL.createObjectURL(stream);
          }
          // this.video.nativeElement.src = window.URL.createObjectURL(stream);
          video.play();
        });
      }
    } else {
      question.needHideVideo = true;
      // Turn off webcam and video stream
      this.videoStream.getVideoTracks()[0].stop();
    }
  }

  private takePhoto(fieldValue: any, question: any) {
    function getContrastYIQ(r, g, b) {
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? 'black' : 'white';
    }

    const canvas = <HTMLCanvasElement>document.getElementById('canvas-' + question.Field);
    const video = <HTMLVideoElement>document.getElementById('video-' + question.Field);
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, 640, 480);

    context.save();
    function getAverageRGB() {

      const blockSize = 5, // only visit every 5 pixels
        defaultRGB = {r:0,g:0,b:0},
        rgb = {r:0,g:0,b:0};
        let data,
        i = -4,
        length,
        count = 0;
      try {
        data = context.getImageData(600, 400, 40, 80);
      } catch(e) {
        return defaultRGB;
      }

      length = data.data.length;

      while ( (i += blockSize * 4) < length ) {
        ++count;
        rgb.r += data.data[i];
        rgb.g += data.data[i + 1];
        rgb.b += data.data[i + 2];
      }

      // ~~ used to floor values
      rgb.r = ~~(rgb.r / count);
      rgb.g = ~~(rgb.g / count);
      rgb.b = ~~(rgb.b / count);

      return rgb;

    }
    let a = getAverageRGB();
    context.fillStyle = getContrastYIQ(a.r, a.g, a.b);
    context.font = "20px serif";
    const date = new Date();
    const datestring = ('0' + date.getDate()).slice(-2) + '-' + ('0' + (date.getMonth() + 1)).slice(-2) + '-' +
      date.getFullYear() + ' ' + ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2) +
      ':' + ('0' + date.getSeconds()).slice(-2);
    context.textAlign = "end";
    context.fillText(datestring, 630, 470);
    context.save();
    this.ourValidate(canvas.toDataURL('image/jpeg', 0.5), fieldValue, question);
    console.log(canvas.toDataURL('image/jpeg', 0.5));
    question.needHideVideo = true;
    // Turn off webcam and video stream
    this.videoStream.getVideoTracks()[0].stop();
  }

  uploadPhoto(event, value, question) {
    console.log(event);
    const file = event.target.files[0];
    const base64Observable = new ReplaySubject<MSBaseReader>(1);

    const fileReader = new FileReader();
    fileReader.onload = event => {
      base64Observable.next(fileReader.result);
    };
    fileReader.readAsDataURL(file);

    base64Observable.subscribe(data => {
      this.ourValidate(data, value, question);
      question.needHideVideo = true;
    })


  }

  modelChangeInputNumber(event, value, question) {
    // Need validate value and save it to value object
    this.userSmsVerificationCode= null;
    this.ourValidate(event, value, question);
    this.checkAndExecuteFormula(value, question);
    if(question.QuestionData && question.QuestionData['data-reset-columns']) {
      this.resetColumns(value, question);
    }
    // this.recheckReadOnlyRules(value, question);
  }

  checkAndExecuteFormula(value, question) {
    if(
      this.dynamicFormService.formulaDependencies[question.Field] &&
      this.dynamicFormService.formulaDependencies[question.Field].length > 0
    ) {
      // If the field takes part in one or more formulas
      _.each(this.dynamicFormService.formulaDependencies[question.Field], formulaDependency => {
        const formula = formulaDependency.formula;
        const calculatedResult = this.dynamicFormService.calculatedValueForInputThroughFormula(value, formula);

        if(formulaDependency.dependField.QuestionData.IsFilterData && value[formulaDependency.dependField.Field]) {
          // Todo create function for this
          const min = value[formulaDependency.dependField.Field][formulaDependency.dependField.QuestionData['data-val-range-min-computed']];
          const max = value[formulaDependency.dependField.Field][formulaDependency.dependField.QuestionData['data-val-range-max-computed']];
          const isValueInInterval = min > calculatedResult && max > calculatedResult;
          if(!isValueInInterval) {
            this.ourValidate(null, value, formulaDependency.dependField);
          }
        } else {
          // Validate calculated data
          this.ourValidate(calculatedResult, value, formulaDependency.dependField);
        }

        // Counting other dependent fields
        if(this.dynamicFormService.formulaDependencies[formulaDependency.dependField.Field]) {
          this.checkAndExecuteFormula(value, formulaDependency.dependField);
        }
      });
    }
  }

  resetColumns(value, question) {
    const resetFields = question.QuestionData['data-reset-columns'].split(',');
    for(let i = 0; i < resetFields.length; i++) {
      const questionObject = this.dynamicFormService.questionsNameToQuestionsObject[resetFields[i]];
      const zeroValue = null;
      this.ourValidate(zeroValue, value, questionObject);
    }
  }
  // recheckReadOnlyRules(value, question) {
  //   if(question && question.QuestionData && question.QuestionData['data-recheck-readonly']) {
  //     this.dynamicFormService.checkReadOnlyRules(this.dynamicFormService.getSectionsIdFromMaping(), value)
  //   }
  // }
  ourValidate(event, value, question) {
    if(question) {
      value.hasOwnProperty(question.Field) ? value[question.Field] = event : null;
      let flag = true;
      if (question.Mandatory && (value[question.Field] === null || (typeof value[question.Field] === 'object' && Object.keys(value[question.Field]).length === 0
          || typeof value[question.Field] === 'string' && !value[question.Field].length))) {
        if ((question.Type === 'Date' && value[question.Field] instanceof Object && !value[question.Field].hasOwnProperty('jsdate')) || question.Type !== 'Date') {
          this.validationData[question.Field].valid = false;
          flag = false;
        }
      }
      if (question.Type === 'ChangeStatus') {
        value['ConsumerCreditStatusId'] = event;
      }

      if (question.Type === 'Number') {
        const integerValue = this.dataService.stringToInteger(value[question.Field]);
        _.each(Object.keys(question.QuestionData), (key) => {
          if (key === 'data-val-range-min' && integerValue < question.QuestionData[key]) {
            this.validationData[question.Field].valid = false;
            this.validationData[question.Field].validationMessage = question.QuestionData['data-val-range'];
            flag = false;
          } else if (key === 'data-val-range-max' && integerValue > question.QuestionData[key]) {
            this.validationData[question.Field].valid = false;
            this.validationData[question.Field].validationMessage = question.QuestionData['data-val-range'];
            flag = false;
          }
          if (key === 'data-val-range-min-computed') {
            const [minField, minPropery] = question.QuestionData[key].split('.');
            const [maxField, maxPropery] = question.QuestionData['data-val-range-max-computed'].split('.');

            if (
              value[minField] && value[minField][minPropery] && value[question.Field] < value[minField][minPropery] ||
              value[maxField] && value[maxField][maxPropery] && value[question.Field] > value[maxField][maxPropery]
            ) {
              this.validationData[question.Field].valid = false;
              const message = _.template(question.QuestionData['data-val-range-computed']);
              this.validationData[question.Field].validationMessage =
                question.QuestionData['data-val-range-computed'] ?
                  message({min: value[minField][minPropery], max: value[maxField][maxPropery]}) :
                  question.QuestionData['data-val-range'];
              flag = value[question.Field] ? false : true;
            }
          }
        });
      }
      if (question.Type === 'ChangeStatus'){
        if (question.QuestionData['data-recheck-readonly']) {
          this.activeSections = this.dynamicFormService.checkReadOnlyRules(this.activeSections, value);
        }
      }
      if (!flag) {
        this.validationData[question.Field].needShowMessage = true;
      } else {
        this.validationData[question.Field].valid = true;
        this.validationData[question.Field].needShowMessage = false;
      }
    }
  }
  private formattedDateNow() {
    return new Date().toISOString().slice(0,10);
  }
  onInputSimpleFocusBlur(event: IMyInputFocusBlur, params): void {
    console.log('onInputFocusBlur(): Reason: ', event. reason, ' - Value: ', event.value);
    console.log(params);
  }

  changeStatus(value, question) {
    this.dataService.submitStepValue(
      this.dynamicFormService.nameOfComponent,
      this.dynamicFormService.requestId,
      this.dynamicFormService.activeStep,
      question.QuestionData['data-set-value']
    ).subscribe(
      data => {
        // TODO : Add universal mechanithm to pass curent value yo our validate
        this.ourValidate(question.QuestionData['data-set-value'].ConsumerCreditStatusId, value, question);
      }
    );
  }

  getBankDocumentList(uploadedFileList) {
    try {
      _.each(this.uploadFormsList, item => {
        for (let key in this.bankDocumentList) {
          key = item.Code;
        }
        this.bankDocumentList[item.Code] = [];
        uploadedFileList.forEach( file => {
          if(file.pdfFileName === item.Code) {
            this.bankDocumentList[file.pdfFileName].push(file);
          }
        });
      });
    }catch(error) {
      console.log(error);
    }

  }

  uploadFile(fileName) {
    this.uploadPdfFileName = fileName;
    this.uploadableFiles.nativeElement.click();
  }

  addPhoto(fileName) {
    fileName.needHideVideo = false;
    this.showVideoUpload(false, fileName)
  }

  private showVideoUpload(needClose: boolean, question: any) {
    if(!needClose) {
      question.needHideVideo = false;
      this.uploadPdfFileName = question.Code;
      // Get access to the camera!
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const video = <HTMLVideoElement>document.getElementById('video-' + question.Code);
        // Not adding `{ audio: true }` since we only want video now
        navigator.mediaDevices.getUserMedia({video: true}).then((stream) => {
          this.videoStream = stream;
          try {
            video.srcObject = stream;
          } catch (error) {
            video.src = URL.createObjectURL(stream);
          }
          // this.video.nativeElement.src = window.URL.createObjectURL(stream);
          video.play();
        });
      }
    } else {
      question.needHideVideo = true;
      // Turn off webcam and video stream
      this.videoStream.getVideoTracks()[0].stop();
    }
  }

  uploadFiles(event, value, question) {
    const name = this.uploadPdfFileName, order = this.bankDocumentList[this.uploadPdfFileName].length;
    const files = event.target.files;
    if (files.length > 0) {
      this.dynamicFormService.uploadFiles(files, name, order).subscribe(
        data => {
          this.bankDocumentList[this.uploadPdfFileName].push({
            name: data.files[0].name,
            thumbnail_url: data.files[0].thumbnail_url,
            url: data.files[0].url,
            pdfFileName: data.files[0].pdfFileName,
          });
          this.ref.detectChanges();
        }
      );
    }
  }

  private takePhotoUpload( question: any, ques) {
    const canvas = <HTMLCanvasElement>document.getElementById('canvas-' + question.Code);
    const video = <HTMLVideoElement>document.getElementById('video-' + question.Code);
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, 640, 480);
    question.needHideVideo = true;
    // Turn off webcam and video stream
    this.videoStream.getVideoTracks()[0].stop();

    const name = this.uploadPdfFileName, order = this.bankDocumentList[this.uploadPdfFileName].length;

    canvas.toBlob(blob => {
      blob['name'] = new Date().getTime() + '.png';
      this.dynamicFormService.uploadFiles([blob], name, order).subscribe(
        data => {
          this.bankDocumentList[this.uploadPdfFileName].push({
            name: data.files[0].name,
            thumbnail_url: data.files[0].thumbnail_url,
            url: data.files[0].url,
            pdfFileName: data.files[0].pdfFileName,
          });
          this.ref.detectChanges();
        }
      );
    })
  }

  getUploadedFilesList() {
    this.dataService.uploadedFilesList(this.dynamicFormService.nameOfComponent, this.dynamicFormService.requestId)
      .subscribe(
        data => {
          this.uploadedFileList = data;
          this.getBankDocumentList(data);
        })
  }

  deleteFile(file) {
    this.dataService.deleteFiles(this.dynamicFormService.nameOfComponent, this.dynamicFormService.requestId, file.name)
      .subscribe(
        data => {
          for (let i = 0; i < this.bankDocumentList[file.pdfFileName].length; i++) {
            if (this.bankDocumentList[file.pdfFileName][i].name === file.name) {
              this.bankDocumentList[file.pdfFileName].splice(i, 1);
            }
          }
        }
      )
  }
  sendClientOTP(value, question) {
    const phoneNumber = value[question.QuestionData['data-set-input'][0]['PhoneNumber']]; // Todo parse it from question by form value
    this.dataService.sendVerificationClientCode( phoneNumber, this.dynamicFormService.nameOfComponent)
      .subscribe( data => {

      }, error => {

      });
  }
  checkClientCode(value, question) {
    this.dataService.checkVerificationClientCode(value[question.QuestionData['data-set-input'][0]['PhoneNumber']],
      this.userSmsVerificationCode, this.dynamicFormService.nameOfComponent)
      .subscribe(data => {
        this.ourValidate(1, value, question);
      }, error => {
        // ToDo: add handling of uncorrect code
      });
  }

  public checkIsInRole(role: string): boolean {
    return this.rolesService.checkPermission([role])
  }
}
