import {Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef} from '@angular/core';
import {DataService} from '../../../shared/services/data.service'
import {ActivatedRoute, Router} from '@angular/router';
import {Observable} from 'rxjs/Observable';
import {Subject} from 'rxjs/Subject';
import { Location } from '@angular/common';
import {RolesService} from '../../../shared/services/roles.service';


@Component({
  selector: 'app-invoice-details',
  styleUrls: ['./invoice-details.component.scss'],
  templateUrl: './invoice-details.component.html'
})

export class InvoiceDetailsComponent implements OnInit, OnDestroy {
  @ViewChild('input') myInput;
  @ViewChild('returnInvoice') returnInvoice;
  @ViewChild('returnOTP') returnOTP;
  @ViewChild('returning') table: any;
  @ViewChild('uploadableFiles') uploadableFiles: any;
  private ngUnsubscribe: Subject<void> = new Subject<void>();
  invoice: any;
  dataForSelects = [];
  invoiceId: number = null;
  isOtpSend = false;
  OTP: string = '';
  returnColumnHidden: boolean = true;
  validMsgReturnNumber: Array<boolean> = [];
  activateReturnStatuses = [37, 38, 39, 40];
  returnAccessible: boolean = false;
  isInvoiceReturnable: boolean = true;
  totalReturnNumber: number = 0;
  returnGoodsIsSending: boolean = false;
  returnSelected: boolean = false;
  selectedReturn: any;
  returnUploadSelected = false;
  selectedReturnUpload: any;
  uploadPdfFileName = '';
  videoStream: any;

  public host;

  public messages: any = {
    // Message to show when array is presented
    // but contains no values
    emptyMessage: 'Нет данных для отображения',
    // Footer total message
    totalMessage: 'всего',
    // Footer selected message
    selectedMessage: 'выбрано'
  };
  returns = [];
  returnsForTable = [];
  dicts: any = {};

  public returnData = {
    returnOTP: '',
    returnInvoice: ''
  };
  public printFormsList = [{
      Code: 'DECLARATION_INVOICE_RETURN',
      Name: 'Заявление на погашение кредита',
      needHideVideo: true
    },
    {
      Code: 'RETURN_GRAPH',
      Name: 'График погашения',
      CreditClosed: false,
      needHideVideo: true
    }];
  public uploadFormList = [];
  public uploadedDocs = {}

  constructor(private dataService: DataService,
              private route: ActivatedRoute,
              private router: Router,
              private cdr: ChangeDetectorRef,
              private location: Location,
              private rolesService: RolesService
  ) {
    this.route.params
      .subscribe(params => {
        this.invoiceId = params['id'];
      });
  }

  getInvoice() {
    this.dataService.getInvoiceDetails(this.invoiceId)
      .subscribe(data => {
        this.invoice = data;

        if(data.CreditForm){
            this.getInvoiceReturns(data.CreditForm);
        }

        const dateNow = new Date();
        const dateInvoice = new Date(this.invoice.InvoiceDateTime);
        dateInvoice.setDate(dateInvoice.getDate() + 14);
        if(dateNow > dateInvoice) this.isInvoiceReturnable = false;

        this.activateReturnStatuses.forEach((status) => {
          if (this.invoice.ConsumerCreditStatusId === status) {
            return this.returnAccessible = true;
          }
        })

      }, error => {
        console.log(error)
      })
  }

  preGetInvoiceReturns(claimId) {
    this.dataService.getInvoiceReturns(claimId)
      .subscribe( data => {
        this.returnsForTable = data;
        this.returns = [];
        data.forEach( returnItem => {
          if(returnItem.StatusId !== 5 && returnItem.StatusId !== 12){
            for(const returnGood of returnItem.Details.Rows[0].Rows) {
              this.returns.push(returnGood);
            }
          }
        });
      }, error => {
        console.log(error)
      })
  }

  getInvoiceReturns(claimId) {
    this.preGetInvoiceReturns(claimId);

    Observable.interval(10000)
      .switchMap(() => this.dataService.getInvoiceReturns(claimId))
      .takeUntil(this.ngUnsubscribe)
      .subscribe(
        data => {
          this.returnsForTable = data;
          this.getTotalReturnPrice();
        },
        error => {
          console.log(error)
        }
      );

    this.dataService.getInvoiceReturns(claimId)
      .subscribe( data => {
        this.returnsForTable = data;
      }, error => {
        console.log(error)
      })
  }

  getTotalReturnPrice() {
    this.returnsForTable.forEach( returnInvoice => {
      returnInvoice['TotalAmount'] = 0;
      for(const returnItem of returnInvoice.Details.Rows[0].Rows) {
        this.invoice.Items.find((item) => {
          if(returnItem.RowId === item.RowId){
            returnInvoice['TotalAmount'] += returnItem.Count * item.Price;
          }
        });
      }
    })
  }

  getReturnProp(RowId, prop) {
    const returnItem = this.invoice.Items.find((item) => {
      return item.RowId === RowId;
    });
    if(returnItem) {
      return returnItem[prop];
    } else {
      return '';
    }
  }

  getCountOfReturns(rowId) {
    let count = 0;
    this.returns.forEach( item => {
      if(item.RowId === rowId) {
        count += item.Count;
      }
    });
    return count;
  }

  ngOnInit() {
    this.host = this.dataService.getHost();
    const requestedDicts = ['vCreditCommercialInvoicesReturnsStatus'];
    requestedDicts.forEach(dictName => {
      this.getDictionary(dictName);
    });

    this.getInvoice();
    this.dataService.getDictionaryValues('vDictShop').subscribe(
      data => {
        let shops = [];
        for(let item of data) {
          if(item.IsActive) {
            shops.push(item);
          }
        }
        this.dataForSelects['shops'] = shops;
      },
      error => {
        console.log(error);
      });
    // shopId
    this.dataService.getDictionaryValues('vDictSalePoint').subscribe(
      data => {
        let salePoints = [];
        for(let item of data) {
          if(item.IsActive) {
            salePoints.push(item);
          }
        }
        this.dataForSelects['salePoints'] = salePoints;
      },
      error => {
        console.log(error);
      });
  }

  getDictionary(dictName: string) {
    this.dataService.getDictionaryValues(dictName)
      .subscribe( dictionary => {
        dictionary.forEach(item => {
          if(item.ListPrintForms) {
            item.ListPrintForms = JSON.parse(item.ListPrintForms);
          }
        });
        this.dicts[dictName] = dictionary;
      })
  }

  getDictValueByProp(dictName: string, prop: any, propName: string, returnPropName: string) {
    if(!dictName || !this.dicts[dictName]) {
      return;
    }

    const item = this.dicts[dictName].find(dictItem => {
      return dictItem[propName] === prop;
    })
    if(item) {
      return item[returnPropName]
    } else {
      return '';
    }
  }

  getNameFromDict(dictName, id) {
    if(!dictName || !id || !this.dataForSelects[dictName]) { return '';}
    const a = this.dataForSelects[dictName].find((item) => {
      return item.Id == id;
    });
    return a && a.Name ? a.Name : '';
  }

  sendOtp() {
    this.isOtpSend = true;
    this.dataService.genereteOTP({})
      .subscribe(data => {
        this.isOtpSend = true;
      }, error => {
        console.log(error)
      })
  }

  giveOutGoods() {
    const requestObject = {
      'CreditForm': this.invoice.CreditForm,
      'InvoiceId': this.invoiceId,
      'OTP': this.OTP
    };
    this.dataService.giveOutGoods(requestObject)
      .subscribe(data => {
        this.router.navigate(['/invoice-list']);
      }, error => {
        console.log(error)
      })
  }

  returnGoods() {
    this.returnGoodsIsSending = true;
    const requestObject = {
      'CreditForm': this.invoice.CreditForm,
      'OTP': this.returnData.returnOTP,
      'ReturnsInvoiceNumber': this.returnData.returnInvoice,
      'Rows': [
        {
          'CreditCommercialInvoiceId': this.invoiceId,
          'Rows': []
        }
      ]
    };
    for(const item of this.invoice.Items) {
      if(item.NumberReturn) {
        requestObject.Rows[0]['Rows'].push({RowId: item.RowId, Count: item.NumberReturn})
      }
    }
    this.dataService.returnInvoice(requestObject).subscribe(
      data => {
        this.returnGoodsIsSending = false;
        this.returnColumnHidden = true;
        this.returnData.returnOTP = '';
        if(this.invoice['CreditForm']){
          this.preGetInvoiceReturns(this.invoice['CreditForm']);
        }
      },
      error => {
        this.returnGoodsIsSending = false;
        this.returnColumnHidden = true;
        this.returnData.returnOTP = '';
        if(this.invoice['CreditForm']){
          this.preGetInvoiceReturns(this.invoice['CreditForm']);
        }
      }
    )
  }

  showReturn() {
    this.sendOtp();
    this.returnColumnHidden = false;
    this.invoice['Items'].forEach(item => {
      item.NumberReturn = 0;
    });
    this.cdr.detectChanges();

  }

  validateNumberReturn(value, max, index, returned) {

    this.totalReturnNumber = 0;
    this.invoice['Items'].forEach(item => {
      this.totalReturnNumber = this.totalReturnNumber + item.NumberReturn;
    });

    if((value > (max - returned.innerText)) || (value < 0)) {
      this.validMsgReturnNumber[index] = true;
    } else this.validMsgReturnNumber[index] = false;
  }

  cancelReturn() {
    this.returnColumnHidden = true;
  }

  checkValidity() {
    return this.validMsgReturnNumber.some(item => {
      return item
    })
  }

  toggleExpandRow(row) {
    this.table.rowDetail.toggleExpandRow(row);
  }

  selectReturn(returnItem) {
    this.returnSelected = true;
    this.selectedReturn = returnItem;

    if(returnItem.BankDetails['CreditClosed'] && returnItem.BankDetails['CreditClosed'] === 1) {
      return this.printFormsList = returnItem.ListPrintForms.InvoicesReturns.slice(0).map( item => {
        if(item.Code === 'RETURN_GRAPH') {
          item['CreditClosed'] = true;
        }
      })
    }
  }
  openUpload(returnItem) {
    this.returnUploadSelected = true;
    this.selectedReturnUpload = returnItem;
    console.log(returnItem);
    this.dataService.getInvoiceReturnDocs(returnItem.NumberReturnsInvoice).subscribe(data => {
      this.uploadedDocs = {};
      for(const item of data) {
        if(!this.uploadedDocs[item.pdfFileName]) {
          this.uploadedDocs[item.pdfFileName] = []
        }
        this.uploadedDocs[item.pdfFileName].push(item)
      }
    })
    returnItem.ListPrintForms.UploadInvoicesReturns.forEach( item => {
      return item.needHideVideo = true;
    })
    this.uploadFormList = returnItem.ListPrintForms.UploadInvoicesReturns
    console.log(this.uploadFormList)
  }
  uploadFile(fileName) {
    this.uploadPdfFileName = fileName;
    this.uploadableFiles.nativeElement.click();
  }
  upload(file, pdfFileName) {
    const name = this.uploadPdfFileName,
      order = this.uploadedDocs[this.uploadPdfFileName] && this.uploadedDocs[this.uploadPdfFileName].length || 0;
    this.uploadFiles(file.target.files, name, order).subscribe(data => {
      if (!this.uploadedDocs[this.uploadPdfFileName]) {
        this.uploadedDocs[this.uploadPdfFileName] = [];
      }
      this.uploadedDocs[this.uploadPdfFileName].push({
        name: data.files[0].name,
        thumbnail_url: data.files[0].thumbnail_url,
        url: data.files[0].url,
        pdfFileName: data.files[0].pdfFileName,
      });
    });
  }
  uploadFiles(files, pdfFileName?, pdfFileOrder?) {
    // const name = this.uploadPdfFileName, order = this.bankDocumentList[this.uploadPdfFileName].length;
    // const files = event.target.files;
    // if (files.length > 0) {
    //   this.dynamicFormService.uploadFiles(files, name, order).subscribe(
    //     data => {
    //       const uploadedImages = [...value.Upload];
    //       for(let i = 0; i < data.files.length; i++) {
    //         uploadedImages.push({
    //           name: data.files[i].name,
    //           thumbnail_url: data.files[i].thumbnail_url,
    //           url: data.files[i].url,
    //           pdfFilename: data.files[i].pdfFilename,
    //         });
    //         this.bankDocumentList[this.uploadPdfFileName].push({
    //           name: data.files[i].name,
    //           thumbnail_url: data.files[i].thumbnail_url,
    //           url: data.files[i].url,
    //           pdfFileName: data.files[i].pdfFileName,
    //         });
    //         this.ref.detectChanges();
    //       }
    //       // this.ourValidate(uploadedImages, value, question);
    //     },
    //     error => {
    //
    //       setTimeout(() => {
    //         window.location.reload()
    //       }, 3000);
    //     }
    //   );
    // }

      const formData: FormData = new FormData();
      for (const file of files) {
        formData.append('files', file, file.name);
      }
      formData.append('uploadContext',  'InvoiceReturns');
      formData.append('objectContext', this.selectedReturnUpload.NumberReturnsInvoice); // id
      formData.append('pdfFileName', pdfFileName);
      formData.append('pdfFileOrder', pdfFileOrder);

      return this.dataService.uploadFiles(formData);

  }
  private takePhotoUpload( question: any, ques) {
    const canvas = <HTMLCanvasElement>document.getElementById('canvas-' + question.Code);
    const video = <HTMLVideoElement>document.getElementById('video-' + question.Code);
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, 640, 480);
    question.needHideVideo = true;
    // Turn off webcam and video stream
    this.videoStream.getVideoTracks()[0].stop();

    const name = this.uploadPdfFileName,
      order = this.uploadedDocs[this.uploadPdfFileName] && this.uploadedDocs[this.uploadPdfFileName].length || 0;

    canvas.toBlob(blob => {
      blob['name'] = new Date().getTime() + '.png';
      this.uploadFiles([blob], name, order).subscribe(
        data => {
          if(!this.uploadedDocs[this.uploadPdfFileName]) {
            this.uploadedDocs[this.uploadPdfFileName] = [];
          }
          this.uploadedDocs[this.uploadPdfFileName].push({
            name: data.files[0].name,
            thumbnail_url: data.files[0].thumbnail_url,
            url: data.files[0].url,
            pdfFileName: data.files[0].pdfFileName,
          });
          // this.ref.detectChanges();
        }
      );
    })
  }
  addPhoto(fileName) {
    fileName.needHideVideo = false;
    this.showVideo(false, fileName)
  }
  private showVideo(needClose: boolean, question: any) {
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
  deleteFile(file) {
    this.dataService.deleteFiles('InvoiceReturns', this.selectedReturnUpload.NumberReturnsInvoice, file.name)
      .subscribe(
        data => {
          for (let i = 0; i < this.uploadedDocs[file.pdfFileName].length; i++) {
            if (this.uploadedDocs[file.pdfFileName][i].name === file.name) {
              this.uploadedDocs[file.pdfFileName].splice(i, 1);
            }
          }
        }
      )
  }
  private takePhoto( question: any) {
    const canvas = <HTMLCanvasElement>document.getElementById('canvas-' + question.Code);
    const video = <HTMLVideoElement>document.getElementById('video-' + question.Code);
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, 640, 480);
    question.needHideVideo = true;
    // Turn off webcam and video stream
    this.videoStream.getVideoTracks()[0].stop();

    const name = this.uploadPdfFileName, order = this.printFormsList[this.uploadPdfFileName].length;

    canvas.toBlob(blob => {
      blob['name'] = new Date().getTime() + '.png';
      // this.dynamicFormService.uploadFiles([blob], name, order).subscribe(
      //   data => {
      //     for(let i = 0; i < data.files.length; i++) {
      //       this.bankDocumentList[this.uploadPdfFileName].push({
      //         name: data.files[i].name,
      //         thumbnail_url: data.files[i].thumbnail_url,
      //         url: data.files[i].url,
      //         pdfFileName: data.files[i].pdfFileName,
      //       });
      //       this.ref.detectChanges();
      //     }
      //   }
      // );
    })
  }

  deleteInvoice() {
    if(this.invoice.CreditForm) {
      return;
    }
    this.dataService.deleteInvoice(this.invoiceId)
      .subscribe(
        data => {
          this.location.back();

        },
        error => {
          console.log(error)
        }
      )
  }

  public checkIsInRole(role: string): boolean {
    return this.rolesService.checkPermission([role])
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}

