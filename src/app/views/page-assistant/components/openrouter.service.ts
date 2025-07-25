import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface OpenRouterMessage {
  role: 'user' | 'system' | 'assistant';
  content: string;
}

export interface OpenRouterResponse {
  choices: {
    message: {
      role: string;
      content: string;
    };
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class OpenRouterService {
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(private http: HttpClient) { }

  sendChat(
    model: string,
    messages: OpenRouterMessage[],
    temperature: number = 0
  ): Observable<string> {
    const apiKey = localStorage.getItem('apiKey');
    console.log(`API KEY USED: ` + apiKey);
    if (!apiKey) {
      return throwError(() => new Error('API key is missing from local storage.'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    });

    const body = {
      model,
      messages,
      temperature
    };

    console.log('Sending to OpenRouter:', {
      model,
      messages,
      temperature
    });

    return this.http.post<OpenRouterResponse>(this.apiUrl, body, { headers }).pipe(
      map(res => res.choices?.[0]?.message?.content || ''),
      catchError(error => {
        console.error('OpenRouter API error:', error);
        return throwError(() => error);
      })
    );
  }
}