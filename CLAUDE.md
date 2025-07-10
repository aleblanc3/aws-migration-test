# Content Assistant - Developer Documentation

## Overview

Content Assistant is an Angular-based application designed to help with various content processing tasks, with a primary focus on image analysis, alt text generation, and bilingual translation for Canada Revenue Agency (CRA) content.

## Image Assistant

The Image Assistant is the core feature of this application, providing image analysis, alt text generation, and translation capabilities.

### Main Components

#### image-assistant.component.ts
**Location:** `src/app/views/image-assistant/image-assistant.component.ts`

The main component orchestrating the image processing workflow. Key responsibilities:
- File selection and validation
- Processing state management
- Coordination between child components
- Result aggregation and export

#### Child Components

- **file-upload.component.ts** (`src/app/views/image-assistant/components/file-upload/`): Handles file selection with drag-and-drop support
- **model-selector.component.ts** (`src/app/views/image-assistant/components/model-selector/`): Allows users to select vision models (GPT-4o-mini, Gemini, etc.)
- **progress-indicator.component.ts** (`src/app/views/image-assistant/components/progress-indicator/`): Shows real-time processing progress
- **image-result.component.ts** (`src/app/views/image-assistant/components/image-result/`): Displays processed results with alt text and translations
- **csv-download.component.ts** (`src/app/views/image-assistant/components/csv-download/`): Exports results to CSV format

### Core Services

#### image-processor.ts
**Location:** `src/app/services/image-processor.ts`

The core service handling all image processing logic:
- Integrates with OpenRouter API for vision analysis
- Generates alt text using selected vision models
- Translates content to French using Google Gemini with CRA-specific terminology
- Handles both image files and PDF pages

Key methods:
- `processImages()`: Main processing method
- `analyzeImage()`: Sends images to vision models for analysis
- `translateToFrench()`: Translates English content with CRA context

#### image-assistant-state.service.ts
**Location:** `src/app/services/image-assistant-state.service.ts`

Manages application state using RxJS:
- Tracks processing progress
- Stores results
- Manages selected files and model preferences
- Provides observables for reactive UI updates

#### pdf-converter.service.ts
**Location:** `src/app/services/pdf-converter.service.ts`

Converts PDF files to images using pdf.js:
- Extracts individual pages as images
- Maintains page order and metadata
- Supports various PDF formats

## API Integration

### OpenRouter API

The application integrates with OpenRouter for AI model access:

**Endpoint:** `https://openrouter.ai/api/v1/chat/completions`

**Vision Models Supported:**
- OpenAI GPT-4o-mini
- Google Gemini Flash 1.5 8B
- Google Gemini Flash 1.5
- Meta Llama 3.2 90B Vision

**Translation Model:**
- Google Gemini Flash 1.5 (with CRA-specific prompting)

### API Key Management

#### api-key.service.ts
**Location:** `src/app/services/api-key.service.ts`

Manages OpenRouter API key:
- Secure storage in browser localStorage
- Validation of API key format
- Observable-based key availability status

#### api-key.component.ts
**Location:** `src/app/common/api-key.component.ts`

UI component for API key input:
- Password-protected input field
- Validation feedback
- Save/update functionality

## Common Patterns

### State Management
- Uses RxJS observables for reactive state management
- Services act as single sources of truth
- Components subscribe to state changes

### Error Handling
- Try-catch blocks in async operations
- User-friendly error messages
- Graceful degradation when API fails

### File Processing
- Support for multiple file formats (JPEG, PNG, GIF, WebP, PDF)
- Batch processing with progress tracking
- Memory-efficient handling of large files

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run start

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Key Technologies

- **Angular 19.2.0**: Main framework
- **PrimeNG**: UI component library
- **RxJS**: Reactive programming
- **pdf.js**: PDF processing
- **TypeScript**: Type-safe development

## Project Structure

```
src/app/
├── views/
│   ├── image-assistant/     # Main image processing feature
│   ├── page-assistant/      # Page comparison tool
│   ├── translation-assistant/
│   ├── project-assistant/
│   └── inventory-assistant/
├── services/                # Shared services
├── common/                  # Shared components
└── app.component.ts        # Root component
```

## Configuration

- **Environment:** Development settings in `angular.json`
- **Routes:** Defined in `src/app/app.routes.ts`
- **TypeScript:** Configuration in `tsconfig.json`

## Best Practices

1. **API Key Security**: Never commit API keys; use environment variables
2. **Error Handling**: Always provide user feedback for failures
3. **State Management**: Use services for shared state
4. **Component Communication**: Use observables for loose coupling
5. **File Processing**: Handle large files efficiently to avoid memory issues