import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.error('GEMINI_API_KEY is not defined in environment variables');
    }
  }

  async generateBiographySummary(rawText: string): Promise<string> {
    if (!this.genAI) {
      throw new Error('Google Generative AI client is not initialized');
    }

    try {
      this.logger.log('Calling Google Gemini API to generate biography summary...');
      const model = this.genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

      const prompt = `Summarize the following artist biography in a concise, professional, and appealing manner suitable for a music event. 

Constraints:
1. The summary must be strictly under 300 words.
2. Detect the language of the raw biography text and write the summary in the exact same language (e.g., if the raw text is in Vietnamese, write the summary in Vietnamese; if in English, write in English, etc.).
3. Return only the biography summary directly. Do not include any titles, markdown formatting, introductory notes, or conversational explanation from you.

Raw biography content:
${rawText}`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text()?.trim();
      if (!text) {
        throw new Error('Gemini API returned an empty response');
      }

      this.logger.log('Successfully generated biography summary from Gemini API');
      return text;
    } catch (error) {
      this.logger.error('Error generating biography summary from Gemini API:', error);
      throw error;
    }
  }
}
