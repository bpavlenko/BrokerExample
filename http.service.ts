import { Injectable } from '@angular/core';
import {
  Http, Response, Headers, RequestOptions, URLSearchParams, RequestMethod,
  ResponseContentType
} from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { HandleErrorService } from './handle-error.service';
import { environment } from '../../../environments/environment';

import 'rxjs/add/operator/catch';
import 'rxjs/add/operator/map';

@Injectable()
export class HttpService {
  private requestOptions: RequestOptions;
  private errorHadnling: (error: Response | any) => Observable<any[]>;
  private HOST: String = environment.production ? '' : '***';
  private HOST_FOR_CLIENT_SIGN: string = 'http://localhost:15479';

  constructor(
    public http: Http,
    public handleErrorService: HandleErrorService,
  ) {
    this.setHeaders();
    this.errorHadnling = (error: Response | any) => this.handleErrorService.handleError(error);
  }
  get host() {
    return this.HOST;
  }

  public get(url: string, options?: string, params?: any, notParseJson?: boolean, useHostforClientSign?: boolean): Observable<any> {
    let reqOptions = new RequestOptions();
    if(!useHostforClientSign) {
      reqOptions = Object.assign({}, this.requestOptions);
    }
    if(params) {
      reqOptions.search = this.getQueryParams(params);
    }
    let extractData = this.extractData;
    if(notParseJson) {
      extractData = this.extractDataText;
    }
    const host = !useHostforClientSign ? this.HOST : this.HOST_FOR_CLIENT_SIGN;
    return this.http.get(host + url + (options || ''), reqOptions)
      .timeout(120000)
      .map(extractData.bind(this))
      .catch(this.errorHadnling);
  }
  public getFile(url: string, options?: string, params?: any, notParseJson?: boolean, useHostforClientSign?: boolean): Observable<any> {
    let reqOptions = new RequestOptions({
      method: RequestMethod.Get,
      responseType: ResponseContentType.ArrayBuffer,
    });
    if(!useHostforClientSign) {
      reqOptions = Object.assign(reqOptions, this.requestOptions);
    }
    if(params) {
      reqOptions.search = this.getQueryParams(params);
    }
    let extractData = this.extractData;
    if(notParseJson) {
      extractData = this.extractDataText;
    }
    const host = !useHostforClientSign ? this.HOST : this.HOST_FOR_CLIENT_SIGN;
    reqOptions.responseType = ResponseContentType.ArrayBuffer;
    return this.http.get(host + url + (options || ''), reqOptions)
      .catch(this.errorHadnling);
  }

  public post(url: string, data?, options?: string, params?: any, notParseJson?: boolean): Observable<any> {
    let reqOptions = Object.assign({}, this.requestOptions);
    if(params) {
      reqOptions.search = this.getQueryParams(params);
    }
    let extractData = this.extractData;
    if(notParseJson) {
      extractData = this.extractDataText;
    }
    return this.http.post(this.HOST + url + (options || ''), data, reqOptions)
      .map(extractData.bind(this))
      .catch(this.errorHadnling);
  }
  public postReturnsFile(url: string, data?, options?: string, params?: any, notParseJson?: boolean): Observable<any> {
    let reqOptions = Object.assign({}, this.requestOptions);
    if(params) {
      reqOptions.search = this.getQueryParams(params);
    }
    let extractData = this.extractData;
    if(notParseJson) {
      extractData = this.extractDataText;
    }
    reqOptions.responseType = ResponseContentType.ArrayBuffer;
    return this.http.post(this.HOST + url + (options || ''), data, reqOptions)
      .catch(this.errorHadnling);
  }

  public put(url: string, data?, options?: string, params?: any, notParseJson?: boolean): Observable<any> {
    const reqOptions = Object.assign({}, this.requestOptions);
    if(params) {
      reqOptions.search = this.getQueryParams(params);
    }
    let extractData = this.extractData;
    if(notParseJson) {
      extractData = this.extractDataText;
    }
    return this.http.put(this.HOST + url + (options || ''), data, reqOptions)
      .map(extractData.bind(this))
      .catch(this.errorHadnling);
  }

  public del(url: string, options?: string): Observable<any> {
    return this.http.delete(this.HOST + url + (options || ''), this.requestOptions)
      .map(this.extractData.bind(this))
      .catch(this.errorHadnling);
  }

  private setHeaders() {
    this.requestOptions = new RequestOptions({ withCredentials: true });
  }

  private extractData(res: Response) {
    let body = '';
    if(res['_body']) {
      body = res.json();
    }
    if(body['Message']) {
      this.handleErrorService.handleWarning(body['Title'], body['Message'])
    }
    return body['Data'] || body || {};
  }

  private extractDataText(res: Response) {
    const body = res.text();
    if(body['Message']) {
      this.handleErrorService.handleWarning(body['Title'], body['Message'])
    }
    return body['Data'] || body || {};
  }

  private getQueryParams(params) {
    const queryParams: URLSearchParams = new URLSearchParams();
    for(const key in params) {
      queryParams.set(key, params[key]);
    }
    return queryParams;
  }
}
