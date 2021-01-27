import {Component, Input, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { DynamicFormService, DataService, ToastService, RolesService } from '../../shared/services';

import * as _ from 'underscore';

@Component({
  selector: 'app-dynamic-form',
  styleUrls: ['./dynamic-form.component.scss'],
  templateUrl: './dynamic-form.component.html'
})

export class DynamicFormComponent implements OnInit, OnDestroy {
  @ViewChild('form') form: any;
  public activeSections: any = [];
  public activeSectionValue: any = {};
  public stepsWithDiffView: any = [];

  private subscriptionForQueryParams: any;

  private isFormBlocked: boolean = false;
  private previousId: string = '';

  public validationTree: any = {};
  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private dynamicFormService: DynamicFormService,
    private dataService: DataService,
    private toastService: ToastService,
    private rolesService: RolesService
  ) {}

  ngOnInit() {
    this.router.events.subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
        document.querySelector('.mat-sidenav-content').scrollTop = 0;
    });
  }

  ngOnDestroy() {
    this.dynamicFormService.clearData();

    if(this.subscriptionForQueryParams) {
      this.subscriptionForQueryParams.unsubscribe();
    }
  }

  @Input()
  set requestId(requestId: any) {
    this.dynamicFormService.requestId = requestId;
  }

  @Input()
  set nameOfComponent(nameOfComponent: string) {
    this.dynamicFormService.nameOfComponent = nameOfComponent;
  }

  @Input()
  set isNew(isNew: boolean) {
    this.dynamicFormService.isNew = isNew;
  }

  @Input()
  set formStructure(formStructure: any) {
    if(formStructure && Object.keys(formStructure).length === 0) {
      return;
    }
    this.dynamicFormService.formStructure = formStructure;
    this.subscribeToQueryParams();
    if(!this.dynamicFormService.isNew) {
      this.stepsWithDiffView = this.dynamicFormService.getStepsWithDiffView(formStructure);
    }
  }

  get formStructure() {
    return this.dynamicFormService.formStructure;
  }
  get currentStep() {
    return this.dynamicFormService.activeStep;
  }
  get isDisabledForm() {
    return this.dynamicFormService.isDisabledForm;
  }

  subscribeToQueryParams() {
    this.subscriptionForQueryParams = this.activatedRoute.queryParams.subscribe(
      params => {
        this.dynamicFormService.clearTabData();
        this.dynamicFormService.setActiveStep(params);
        if(!this.dynamicFormService.isNew) {
          this.getActiveSectionValue();
        } else {
          this.buildEmptyObjectForNgModel();
        }
      }
    );
  }

  getActiveSectionValue() {
    this.dataService.getStepValue(
      this.dynamicFormService.nameOfComponent,
      this.dynamicFormService.requestId,
      this.dynamicFormService.activeStep
    ).then(activeSectionValue => {
      this.activeSections =
        this.dynamicFormService.checkReadOnlyRules(this.dynamicFormService.getSectionsIdFromMaping(), activeSectionValue);
      this.activeSectionValue = activeSectionValue;
      // When creating a new order with the data from the created one, you must resetting invoice value
      this.validateData(this.activeSectionValue);
      this.unlockForm();

    }, error => { this.unlockForm(); console.error(error)});
  }

  buildEmptyObjectForNgModel() {
    new Promise((resolve, reject) => {
      this.activeSections = this.dynamicFormService.getSectionsIdFromMaping();
      const activeSectionValue = this.dynamicFormService.buildEmptyObjectForNgModel(this.activeSections);
      resolve(activeSectionValue);
    }).then(activeSectionValue => {
      // Todo check it
      // Todo add if approve using ReadOnlyRules for new claims
      // this.activeSections =
      //   this.dynamicFormService.checkReadOnlyRules(this.dynamicFormService.getSectionsIdFromMaping(), activeSectionValue);
      this.activeSectionValue = activeSectionValue;
      this.activeSectionValue.IsOnLine = 0;
      this.validateData(this.activeSectionValue);
      this.unlockForm();
    });
  }

  onSubmit(stepId?) {
    if(this.isFormBlocked) {
      console.log('blocked')
      return;
    } else {
      this.previousId = stepId;
      if (this.isStepHasAnotherView() || this.isDisabledForm) {
        this.router.navigate([], {queryParams: {step: stepId}});
      } else {
        if (this.form && this.form.value && this.checkIsInRole('Agent:Edit')) {
          if (this.canSendForm() || stepId) {
            const preparedValues =
              this.dynamicFormService.parseValueOfInputToPrimitiveBeforeSubmit(this.activeSections, this.form.value);
            if (this.dynamicFormService.isNew) {
              this.createNewClaim(preparedValues);
            } else {
              this.changeExistingClaim(preparedValues, stepId);
            }
          } else {
            this.toastService.toAstr('error', {message: 'Не заполнены все обязательные поля!'})
          }
        }
      }
    }
    // if(this.form && this.form.value && !this.isStepHasAnotherView()) {
    //   if(this.checkIsInRole('Agent:Edit')) {
    //     const preparedValues =
    //       this.dynamicFormService.parseValueOfInputToPrimitiveBeforeSubmit(this.activeSections, this.form.value);
    //     if (this.dynamicFormService.isNew) {
    //       this.createNewClaim(preparedValues);
    //     } else {
    //       this.changeExistingClaim(preparedValues, stepId);
    //     }
    //   } else {
    //     if(stepId && !this.isNew) {
    //       this.router.navigate([], {queryParams: {step: stepId}});
    //     }
    //   }
    // } else if(!stepId) {
    //   this.toastService.toAstr('error', {message: 'Не заполнены все обязательные поля!'})
    // }
    // else if(this.isStepHasAnotherView()) {
    //   this.router.navigate([], {queryParams:{step: stepId}});
    // }

    // Navigate to step
    // if(stepId && !this.isNew) {
    //   this.router.navigate([], {queryParams:{step: stepId}});
    // }
  }
  unlockForm() {
    this.dataService.isShowingLoaderForClaimSteps = false;
  }
  lockForm() {
    this.dataService.isShowingLoaderForClaimSteps = true;
  }

  isStepHasAnotherView() {
    return this.dynamicFormService.isStepHasAnotherView(this.stepsWithDiffView);
  }

  clearAction() {
    if(this.dynamicFormService.isNew) {
      this.buildEmptyObjectForNgModel();
    } else {
      // Todo check if
      this.getActiveSectionValue();
    }
  }

  cancelAction() {
    const parentUrl = 'credit/' + this.dynamicFormService.nameOfComponent;
    this.router.navigate([parentUrl + '/list']);
  }

  private createNewClaim(value) {
    const parentUrl = 'credit/' + this.dynamicFormService.nameOfComponent;

    this.dataService.createNewClaim(
      this.dynamicFormService.nameOfComponent,
      value.data
    ).subscribe(
      data => {
        this.router.navigate([parentUrl, data.Id, 'change']);
      },
      error => console.error(error)
    );

  }

  private changeExistingClaim(value, stepId?) {
    this.lockForm();
    this.dataService.submitStepValue(
      this.dynamicFormService.nameOfComponent,
      this.dynamicFormService.requestId,
      this.dynamicFormService.activeStep,
      value.data
    ).subscribe(
      data => {

        if(!stepId) {
          const indexOfNextStep = this.dynamicFormService.getIndexOfNextStep();
          this.router.navigate([], {queryParams:{step: this.formStructure.Steps[indexOfNextStep].Id}});
        } else {
          this.router.navigate([], {queryParams: {step: stepId}});
        }
        // Todo add smooth scroll to top
      },
      error => {
        this.unlockForm();
        if(stepId) {
          this.router.navigate([], {queryParams: {step: stepId}});
        }
        console.error(error)

      }
    );
  }

  private validateData(data) {
    this.validationTree = {};
    _.each(this.activeSections, section => {
      _.each(section.Questions, question => {
        let flag = true;
        if (!this.validationTree[question.Field]) {
          this.validationTree[question.Field] = {valid: true, validationMessage: '', needShowMessage: false};
        }
        let initialData = data[question.Field];
        // If question have default value in JSON write it to data
        if((initialData === null || ((typeof initialData === 'object'  || typeof initialData === 'string') && !initialData.length)) && question.hasOwnProperty('Value')){
          data[question.Field] = question.Value;
          initialData = data[question.Field];
        }
        if((initialData === null || ((typeof initialData === 'object'  || typeof initialData === 'string') && !initialData.length))
          && question.QuestionData && question.QuestionData.hasOwnProperty('data-val-set-initial-func')) {
          if(question.QuestionData['data-val-set-initial-func'] === 'getCurrentDay'){
            data[question.Field] = new Date().getDay();
            initialData = data[question.Field];
          }
        }
        // if (question.Mandatory && ((typeof initialData === 'object' || typeof initialData === 'string') && !initialData.length)) {
        if (question.Mandatory && (initialData === null || ((typeof initialData === 'object'  || typeof initialData === 'string') && !initialData.length))) {
            this.validationTree[question.Field].valid = false;
            flag = false;
        }
        if (question.Type === "Number" && flag) {
          _.each(Object.keys(question.QuestionData), (key) => {
            if (initialData && key == "data-val-range-min" && initialData < question.QuestionData[key]) {
              this.validationTree[question.Field].valid = false;
              flag = false;
              this.validationTree[question.Field].validationMessage = question.QuestionData['data-val-range'];
            } else if (initialData && key == "data-val-range-max" && initialData > question.QuestionData[key]) {
              this.validationTree[question.Field].valid = false;
              flag = false;
              this.validationTree[question.Field].validationMessage = question.QuestionData['data-val-range'];
            }
          })
        }
        if(flag) {
          this.validationTree[question.Field] = {valid: true, validationMessage: '', needShowMessage: false};
        }

      });
    });
  }
  private canSendForm(): boolean {
    let result = true;
    for(const item in this.validationTree) {
      let question = null;
        _.each(this.activeSections, (section) => {
          question = _.find(section.Questions, (quest) => {
          return quest.Field === item;
        })
      })
      if(this.validationTree[item].valid === false &&
        question && this.dynamicFormService.isShowElementInTabComponent(question, this.activeSectionValue)) {
        this.validationTree[item].needShowMessage = true;
        result = false;
      }
    }
    return result;
  }

  get formattedDateNow() {
    return new Date().toISOString().slice(0,10);
  }

  private getInfoDocument() {
    const popupWin = window.open('', '_blank', 'top=0,left=0,height=100%,width=auto');
    popupWin.document.open();
    this.dataService.getInfoDoc().subscribe(
      data => {
        const document = data.replace('%DATE%', this.formattedDateNow);
        popupWin.document.write(`
          <html>
              <head>
              </head>
              <body onload="window.print();">${document}
              </body>
          </html>`
        );
        popupWin.document.close();
      },
      error => console.log(error)
    );
  }

  private getConsentUsePersonaldata() {
    const popupWin = window.open('', '_blank', 'top=0,left=0,height=100%,width=auto');
    popupWin.document.open();
    this.dataService.getConsentUsePersonaldata().subscribe(
      data => {
        popupWin.document.write(`
          <html>
              <head>
              </head>
              <body onload="window.print();">${data}
              </body>
          </html>`
        );
        popupWin.document.close();
      },
      error => console.log(error)
    );
  }

  private printDocument(data) {
    const popupWin = window.open('', '_blank', 'top=0,left=0,height=100%,width=auto');
    popupWin.document.open();
    popupWin.document.write(`
          <html>
              <head>
              </head>
              <body onload="window.print();">${data}
              </body>
          </html>`
    );
    popupWin.document.close();
  }

  public checkIsInRole(role: string): boolean {
    return this.rolesService.checkPermission([role])
  }
}
