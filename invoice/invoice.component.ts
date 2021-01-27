import {Component, OnInit} from '@angular/core';
import {FormArray, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Observable} from 'rxjs';
import {DataService} from '../../shared/services/data.service'

import {IqSelect2Item} from 'ng2-iq-select2';
import {MdInputModule} from '@angular/material';
import createNumberMask from 'text-mask-addons/dist/createNumberMask';
import * as _ from 'underscore';
import {Router} from '@angular/router';

@Component({
  selector: 'app-invoice',
  styleUrls: ['./invoice.component.scss'],
  templateUrl: './invoice.component.html'
})

export class InvoiceComponent implements OnInit{
  // Todo remove to another place
  public selectNoResultMsg = 'Нет доступных результатов';
  public invoiceForm: FormGroup;
  public listItemsMax: (term: string) => Observable<any[]>;
  public getItems: (ids: string[]) => Observable<any[]>;
  public entityToIqSelect2Item: (entity: any) => IqSelect2Item;
  public dataForSelects: any[] = [];
  public getItemsForSelect: (term: string, criteria: string) => Observable<any[]>;
  public list: any[] = [];
  public totalProductAmount = 0;
  public Items: [
    {RowId:1,Name:'',Amount:0,ArticleCode:'',NumberPieces:1,TotalAmount:0}
    ];
  public mask = createNumberMask({
    thousandsSeparatorSymbol: ' ',
    allowDecimal: true,
    allowNegative: true,
    prefix: '',
    suffix: ''
  });
  public shopIsHighRisk: boolean = false;


  // Todo maybe changed logic of default data
  public date = new Date();
//
  constructor(private formBuilder: FormBuilder, private dataService: DataService, private router: Router) {

  }
//

  ngOnInit() {
    //salePoints
    this.dataService.getDictionaryValues("vDictShop").subscribe(
      data=>{
        let shops = [];
        for(let item of data) {
          if(item.IsActive){
            shops.push(item);
          }
        }
        this.dataForSelects['shops'] = shops;
        const shopId = JSON.parse(localStorage.getItem('userInfo'))['shopId'];
        if(shopId){
          shops.forEach( shop => {
            if(shop.Id === shopId && shop.IsHighRisk){
              this.shopIsHighRisk = true;
              this.initForm();
            }
          })
        }
      },
      error => {
        console.log(error);
      });
    //shopId
    this.dataService.getDictionaryValues("vDictSalePoint").subscribe(
      data=>{
        let salePoints = [];
        for(let item of data) {
          if(item.IsActive){
            salePoints.push(item);
          }
        }
        this.dataForSelects['salePoints'] = salePoints;
      },
      error => {
        console.log(error);
      });
    //Brand
    this.dataService.getDictionaryValues("vDictBrand").subscribe(
      data=>{
        let brands = [];
        for(let item of data) {
          if(item.IsActive){
            brands.push(item);
          }
        }
        this.dataForSelects['brands'] = brands;
        this.dataForSelects['brandsFiltered'] = [];
      },
      error => {
        console.log(error);
      });
    this.dataService.getProductGroups().subscribe(
      data => {
        let productGroups = [];
        for(const item of data) {
          for(const category of item.Categories) {
            productGroups.push(category);
          }
        }
        this.dataForSelects['productGroups'] = productGroups;
      },
      error => {
        console.log(error);
      });
    this.initForm();

    this.initializeIqSelect2();
  }

  get desktop(){
    return this.dataService.isDesktop;
  }

  initData(rowId?) {
    return this.formBuilder.group({
      RowId: [rowId+1],
      Name: ['', Validators.required],
      Amount: [null, Validators.required],
      ArticleCode: ['', Validators.maxLength(64)],
      NumberPieces: [1, Validators.required],
      TotalAmount: [{value:'0', disabled:true}]
    });
  }
  onSelectCategory(item: IqSelect2Item, i) {
    this.dataForSelects['brandsFiltered'] = [];
    this.invoiceForm.controls.Items['controls'][i].controls['BrandId'].setValue(null);

    this.dataForSelects['brands'].forEach(brand => {
      if(brand.ProductSubCategoryId === item.id){
        this.dataForSelects['brandsFiltered'].push(brand);
      }
    });

  }

  initDataHighRisk(rowId?) {
    return this.formBuilder.group({
      RowId: [rowId+1],
      Name: ['', Validators.required],
      Amount: [null, Validators.required],
      ArticleCode: ['', Validators.maxLength(64)],
      NumberPieces: [1, Validators.required],
      ProductSubCategoryId: [null, Validators.required],
      BrandId: [null, Validators.required],
      TotalAmount: [{value:'0', disabled:true}]
    });
  }
  initForm() {
    this.invoiceForm = this.formBuilder.group({
      InvoiceNumber: [null, Validators.required],
      OTP: ['', Validators.required],
      InvoiceDateTime: [this.date.toISOString().slice(0,10), Validators.required],
      Items: this.shopIsHighRisk ? this.formBuilder.array([this.initDataHighRisk(0),]) : this.formBuilder.array([this.initData(0),])
    });

    this.invoiceForm.get('Items').valueChanges
      .debounceTime(500)
      .subscribe(data => {
        Object.keys(data).forEach((name, index) => {
          if (this.invoiceForm.controls['Items']['controls'][name]) {
            let objectForm = this.invoiceForm.controls['Items']['controls'][name];
            const amountValue = objectForm.controls.Amount.value ? objectForm.controls.Amount.value : '0';
            let amount = amountValue.replace(/[^0-9\\.]+/g, '');
            objectForm.controls.TotalAmount.patchValue((objectForm.controls.NumberPieces.value * amount).toFixed(2));
            // Todo make some refactoring
            if(!index) {
              this.totalProductAmount = objectForm.controls.NumberPieces.value * amount;
            } else {
              this.totalProductAmount += objectForm.controls.NumberPieces.value * amount;
            }
          }
        });
      });
  }
  getOtp() {
    this.dataService.genereteOTP({})
      .subscribe(data => {
        if (data && data.otp && data.otp.length) {
          this.invoiceForm.patchValue({OTP: data.otp});
        }
      })
  }
  addData() {
    const control = <FormArray>this.invoiceForm.controls['Items'];
    this.shopIsHighRisk ? control.push(this.initDataHighRisk(control.controls.length)) : control.push(this.initData(control.controls.length));
  }
  removeAddress(i: number) {
    const control = <FormArray>this.invoiceForm.controls['Items'];
    control.removeAt(i);
  }
  private initializeIqSelect2() {
    this.getItemsForSelect = (term: string, criteria:string) => this.getItemsForSelects(term, criteria);
    this.getItems = (ids: string[]) => this.getItemsa(ids);
    this.entityToIqSelect2Item = (entity: any) => {
      return {
        id: entity.Id,
        text: entity.Name,
        entity: entity
      };
    };
  }
  public getItemsa(ids: string[]): Observable<any[]> {
    let selectedItems: any[] = [];

    ids.forEach((id) => {
      this.list
        .filter((item) => item.id == id)
        .map((item) => selectedItems.push(item));
    });

    return Observable.of(selectedItems);
  }
  public getItemsForSelects(pattern: string, criteria: string, maxResults?: number): Observable<any[]> {
    return Observable.of(this.dataForSelects[criteria]
      .filter((list) => list['Name'].toUpperCase().indexOf(pattern.toUpperCase()) !== -1));
  }

  private sortFunction(country1: any, country2: any) {
    if (country1.name < country2.name) {
      return -1;
    }
    if (country1.name > country2.name) {
      return 1;
    }
    return 0;
  }

  save(model) {
    let items = this.invoiceForm.get('Items');
    _.each(items['controls'], control =>{
      control.controls.Amount.patchValue(parseFloat(control.controls.Amount.value.replace(/[^0-9\\.]+/g, '')));
    });
    this.dataService.saveInvoice(this.invoiceForm.getRawValue()).subscribe(
      data => {
        this.router.navigate(['/invoice-list']);
      },
      error => {
        console.log(error)
      }
    )
  }
};

