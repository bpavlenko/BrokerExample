import {Component, OnInit, OnChanges} from '@angular/core';
import {DataService} from '../../../shared/services/data.service'
import {Page} from '../../../../types/page';
import {FormBuilder, FormGroup} from '@angular/forms';
import {IMyDrpOptions, IMyInputFocusBlur} from 'mydaterangepicker';
import {Observable} from 'rxjs/Observable';
import {IqSelect2Item} from 'ng2-iq-select2';
import {TimezoneDatePipe} from '../../../shared/pipes';
import {ModalsService} from '../../../shared/services/modals.service';
import print from 'print-js';
import {RolesService} from '../../../shared/services/roles.service';

@Component({
  selector: 'app-invoice-list',
  styleUrls: ['./invoice-list.component.scss'],
  templateUrl: './invoice-list.component.html'
})

export class InvoiceListComponent implements OnInit, OnChanges {
  invoices: any;
  dataForSelects = [];
  public messages: any = {
    // Message to show when array is presented
    // but contains no values
    emptyMessage: 'Нет данных для отображения',
    // Footer total message
    totalMessage: 'всего',
    // Footer selected message
    selectedMessage: 'выбрано'
  };
  public isDrpFocus: boolean = false;
  public myDateRangePickerOptions: IMyDrpOptions = {
    dateFormat: 'dd.mm.yyyy',
    sunHighlight: false,
    height: '17px',
    width: '220px',
    selectorWidth: '260px',
    selectorHeight: '350px',
    showApplyBtn: false,
    selectBeginDateTxt: 'Начальная дата',
    selectEndDateTxt: 'Конечная дата',
    indicateInvalidDateRange: true,
    monthLabels: { 1: 'ЯНВ', 2: 'ФЕВР', 3: 'МАРТ', 4: 'АПР', 5: 'МАЙ', 6: 'ИЮНЬ', 7: 'ИЮЛЬ', 8: 'АВГ', 9: 'СЕНТ', 10: 'ОКТ', 11: 'НОЯБ', 12: 'ДЕК' },
    dayLabels: {su: 'ВС', mo: 'ПН', tu: 'ВТ', we: 'СР', th: 'ЧТ', fr: 'ПТ', sa: 'СБ'}
  };
  page = new Page();
  public searchInvoiceForm: FormGroup;
  public searchPanelClosed: boolean = true;

  public retrievedData = false;
  public getItems: any;
  public entityToIqSelect2Item: any;
  public getItemsForSelect: any;

  constructor(
    private dataService: DataService,
    private formBuilder: FormBuilder,
    private modalsService: ModalsService,
    private rolesService: RolesService
  ) {
    this.page.offset = 0;
    this.page.limit = 10;
  }

  ngOnInit() {
    this.getDataForSelects();
    this.initializeIqSelect2();
    this.initComponent();
  }

  ngOnChanges() {
    this.initComponent();
  }

  private getDataForSelects() {
    this.dataService.getDictionaryValues('vSellers').subscribe(
      data => {
        const sellers = [];
        for(const item of data) {
          sellers.push(item);
        }
        this.dataForSelects['sellers'] = sellers;
      },
      error => {
        console.log(error);
      });

    this.dataService.getDictionaryValues('vDictShop').subscribe(
      data => {
        const shops = [];
        for(const item of data) {
          if(item.IsActive) {
            shops.push(item);
          }
        }
        this.dataForSelects['shops'] = shops;
      },
      error => {
        console.log(error);
      });
    this.dataService.getDictionaryValues('vDictConsumerCreditStatus').subscribe(
      data => {
        let status = [];
        for(let item of data) {
          if(item.IsActive){
            status.push(item);
          }
        }
        this.dataForSelects['status'] = status;
      },
      error => {
        console.log(error);
      });
  }

  private initializeIqSelect2() {
    this.getItemsForSelect = (question: any) =>{
      return (term: string, criteria: string) => this.getItemsForSelects(term, criteria, null, question);
    };
    this.getItems = (question: any) => {
      return (ids: string[], list: string) => this.getItemsa(ids, list, question);
    };
    this.entityToIqSelect2Item = (question: any) => {
      return (entity: any) => {
        return {
          id: entity[question.val],
          text: entity[question.text],
          entity: entity
        };
      }
    };
  }
  public getItemsa(ids: string[], list: string, question: any): Observable<any[]> {
    const selectedItems: any[] = [];

    ids.forEach((id) => {
      this.dataForSelects[list]
        .filter((item) => item[question.val] === id)
        .map((item) => selectedItems.push(item));
    });

    return Observable.of(selectedItems);
  }

  public getItemsForSelects(pattern: string, criteria: string, maxResults?: number, question?: any): Observable<any[]> {
    return Observable.of(this.dataForSelects[criteria]
      .filter((list) => list[question.text] && list[question.text].toUpperCase().indexOf(pattern.toUpperCase()) !== -1));
  }

  onInputFocusBlur(event: IMyInputFocusBlur): void {
    // console.log('onInputFocusBlur(): Reason: ', event. reason, ' - Value: ', event.value);
    if(event.reason === 1 ) {
      this.isDrpFocus = true;
    } else {
      this.isDrpFocus = false;
    }
  }

  getNameFromDict(dictName, id) {
    if(!dictName || !id || !this.dataForSelects[dictName]) { return '';}
    const data = this.dataForSelects[dictName].find((item) => {
      return item.Id == id;
    });
    return data && data.Name ? data.Name : '';
  }

  setDateRange(): void {
    // Set date range (today) using the patchValue function
    let date = new Date();
    this.searchInvoiceForm.patchValue({DateRange: {
      beginDate: {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
      },
      endDate: {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate()
      }
    }});
  }

  prepareDataForDateFields(value): any {
    const data = Object.assign({startDate: null, endDate: null}, value);
    if(data.DateRange) {
      data['startDate'] = this.convertDate(data.DateRange.beginDate);
      data['endDate'] = this.convertDate(data.DateRange.endDate);
    }
    delete data.DateRange;
    return data;
  }

  private convertDate(dateObject: any): string {
    return dateObject.year + '-' + dateObject.month + '-' + dateObject.day;
  }

  setPage(event?) {
    const data = this.prepareDataForDateFields(this.searchInvoiceForm.value);
    let concatedData = null;
    if(event) {
      concatedData = Object.assign( data,
        {
          skip: (event && event.offset || 0) * event.offset,
          count: event && event.limit || this.page.limit
        }
      );
    } else {
      concatedData = Object.assign( data,
        {
          skip: 0,
          count: this.page.limit
        })
    }

    this.dataService.getInvoiceList(concatedData)
      .subscribe(data => {
        this.invoices = data.Items;
        this.page.totalElements = data.ItemsCount;
        this.page.offset = event && event.offset || 0;
      }, error => {
        console.log(error)
      });
  }


  private initComponent() {
    this.searchInvoiceForm = this.formBuilder.group({
      iin: null,
      invoiceNumber: null,
      contractCode: null,
      DateRange: null,
      userId: null,
      shopId: null,
      goodsNotIssued: false
    });
    this.setDateRange();
    this.setPage(this.page);
  }

  public toggleSearchPanel() {
    this.searchPanelClosed = !this.searchPanelClosed;
  }
  public openPrintReports() {
    this.modalsService.chooseReportsPrint('InvoiceListOfPrintForms').subscribe(
      result => {
        for (const val of result) {
          const data = this.prepareDataForDateFields(this.searchInvoiceForm.value);
          for(let key in data) {
            if(data.hasOwnProperty(key)) {
              const newKey = key[0].toUpperCase() + key.substring(1);
              data[newKey] = data[key];
              delete data[key];
            }
          }
          data['ReportName'] = val;
          this.dataService.downloadInvoiceReport(data)
            .subscribe(res => {
              const blob = new Blob([res.blob()], { type: 'application/pdf' });
              const url = URL.createObjectURL(blob);
              const p = print({
                printable: url,
                showModal: true,
                modalMessage: 'Подготовка печати',
                onError: () => {
                }
              });
            })
        }
      }
    );
  }

  public checkIsInRole(role: string): boolean {
    return this.rolesService.checkPermission([role])
  }
  public resetFilter() {
    this.searchInvoiceForm.reset();
    this.setDateRange();
    this.setPage();

  }
}

