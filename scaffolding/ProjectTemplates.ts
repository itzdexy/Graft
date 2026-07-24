/**
 * Advanced project templates and scaffolding system
 * Provides project scaffolding with customizable templates and generators
 */

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'desktop' | 'cli' | 'library';
  language: string;
  framework?: string;
  files: TemplateFile[];
  dependencies: Dependency[];
  devDependencies: Dependency[];
  scripts: Record<string, string>;
  configuration: Record<string, unknown>;
  postInstall?: string[];
}

export interface TemplateFile {
  path: string;
  content: string;
  executable?: boolean;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev' | 'peer';
}

export interface ScaffoldConfig {
  projectName: string;
  template: string;
  destination: string;
  options: Record<string, unknown>;
  gitInit: boolean;
  installDependencies: boolean;
  runPostInstall: boolean;
}

export interface Generator {
  name: string;
  type: 'component' | 'page' | 'service' | 'hook' | 'util' | 'test';
  template: string;
  options: GeneratorOption[];
}

export interface GeneratorOption {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'enum';
  description: string;
  default?: unknown;
  required: boolean;
  enum?: string[];
}

class ProjectScaffoldingSystem {
  private templates: Map<string, ProjectTemplate> = new Map();
  private generators: Map<string, Generator> = new Map();
  private customTemplates: Map<string, ProjectTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
    this.initializeDefaultGenerators();
  }

  /**
   * Initialize default project templates
   */
  private initializeDefaultTemplates(): void {
    // TypeScript/React Template
    this.templates.set('react-typescript', {
      id: 'react-typescript',
      name: 'React + TypeScript',
      description: 'Modern React application with TypeScript, Vite, and Tailwind CSS',
      category: 'frontend',
      language: 'typescript',
      framework: 'react',
      files: [
        {
          path: 'package.json',
          content: JSON.stringify({
            name: '{{projectName}}',
            version: '0.1.0',
            type: 'module',
            scripts: {
              dev: 'vite',
              build: 'tsc && vite build',
              preview: 'vite preview',
              lint: 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
            },
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
            },
            devDependencies: {
              '@types/react': '^18.2.43',
              '@types/react-dom': '^18.2.17',
              '@vitejs/plugin-react': '^4.2.1',
              typescript: '^5.2.2',
              vite: '^5.0.8',
              eslint: '^8.55.0',
            },
          }, null, 2),
        },
        {
          path: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              useDefineForClassFields: true,
              lib: ['ES2020', 'DOM', 'DOM.Iterable'],
              module: 'ESNext',
              skipLibCheck: true,
              moduleResolution: 'bundler',
              allowImportingTsExtensions: true,
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: 'react-jsx',
              strict: true,
              noUnusedLocals: true,
              noUnusedParameters: true,
              noFallthroughCasesInSwitch: true,
            },
            include: ['src'],
            references: [{ path: './tsconfig.node.json' }],
          }, null, 2),
        },
        {
          path: 'vite.config.ts',
          content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
        },
        {
          path: 'src/main.tsx',
          content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
        },
        {
          path: 'src/App.tsx',
          content: `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <h1>Welcome to {{projectName}}</h1>
      <button onClick={() => setCount(count + 1)}>
        Count is {count}
      </button>
    </div>
  )
}

export default App`,
        },
        {
          path: 'src/index.css',
          content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app {
  padding: 2rem;
  text-align: center;
}`,
        },
        {
          path: 'index.html',
          content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        },
        {
          path: '.gitignore',
          content: `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?`,
        },
      ],
      dependencies: [
        { name: 'react', version: '^18.2.0', type: 'runtime' },
        { name: 'react-dom', version: '^18.2.0', type: 'runtime' },
      ],
      devDependencies: [
        { name: '@types/react', version: '^18.2.43', type: 'dev' },
        { name: '@types/react-dom', version: '^18.2.17', type: 'dev' },
        { name: '@vitejs/plugin-react', version: '^4.2.1', type: 'dev' },
        { name: 'typescript', version: '^5.2.2', type: 'dev' },
        { name: 'vite', version: '^5.0.8', type: 'dev' },
      ],
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
      configuration: {},
    });

    // Node.js/Express Template
    this.templates.set('node-express', {
      id: 'node-express',
      name: 'Node.js + Express',
      description: 'RESTful API with Express, TypeScript, and MongoDB',
      category: 'backend',
      language: 'typescript',
      framework: 'express',
      files: [
        {
          path: 'package.json',
          content: JSON.stringify({
            name: '{{projectName}}',
            version: '1.0.0',
            main: 'dist/index.js',
            scripts: {
              dev: 'ts-node src/index.ts',
              build: 'tsc',
              start: 'node dist/index.js',
              test: 'jest',
            },
            dependencies: {
              express: '^4.18.2',
              mongoose: '^8.0.3',
              dotenv: '^16.3.1',
            },
            devDependencies: {
              '@types/express': '^4.17.21',
              '@types/node': '^20.10.5',
              typescript: '^5.3.3',
              'ts-node': '^10.9.2',
            },
          }, null, 2),
        },
        {
          path: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              module: 'commonjs',
              lib: ['ES2020'],
              outDir: './dist',
              rootDir: './src',
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              forceConsistentCasingInFileNames: true,
            },
            include: ['src/**/*'],
          }, null, 2),
        },
        {
          path: 'src/index.ts',
          content: `import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to {{projectName}}' })
})

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`)
})`,
        },
        {
          path: '.env.example',
          content: `PORT=3000
MONGODB_URI=mongodb://localhost:27017/{{projectName}}`,
        },
        {
          path: '.gitignore',
          content: `node_modules
dist
.env
*.log`,
        },
      ],
      dependencies: [
        { name: 'express', version: '^4.18.2', type: 'runtime' },
        { name: 'mongoose', version: '^8.0.3', type: 'runtime' },
        { name: 'dotenv', version: '^16.3.1', type: 'runtime' },
      ],
      devDependencies: [
        { name: '@types/express', version: '^4.17.21', type: 'dev' },
        { name: '@types/node', version: '^20.10.5', type: 'dev' },
        { name: 'typescript', version: '^5.3.3', type: 'dev' },
      ],
      scripts: {
        dev: 'ts-node src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js',
      },
      configuration: {},
    });

    // Python/FastAPI Template
    this.templates.set('python-fastapi', {
      id: 'python-fastapi',
      name: 'Python + FastAPI',
      description: 'Modern Python API with FastAPI, async support, and Pydantic',
      category: 'backend',
      language: 'python',
      framework: 'fastapi',
      files: [
        {
          path: 'requirements.txt',
          content: `fastapi==0.109.0
uvicorn==0.27.0
pydantic==2.5.3
python-dotenv==1.0.0`,
        },
        {
          path: 'main.py',
          content: `from fastapi import FastAPI
from pydantic import BaseModel
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="{{projectName}}")

class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float | None = None

@app.get("/")
async def root():
    return {"message": "Welcome to {{projectName}}"}

@app.post("/items/")
async def create_item(item: Item):
    return item

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)`,
        },
        {
          path: '.env.example',
          content: `DATABASE_URL=sqlite:///./test.db
SECRET_KEY=your-secret-key`,
        },
        {
          path: '.gitignore',
          content: `__pycache__
*.py[cod]
*$py.class
.env
venv/
.venv/`,
        },
      ],
      dependencies: [
        { name: 'fastapi', version: '0.109.0', type: 'runtime' },
        { name: 'uvicorn', version: '0.27.0', type: 'runtime' },
        { name: 'pydantic', version: '2.5.3', type: 'runtime' },
      ],
      devDependencies: [],
      scripts: {
        dev: 'uvicorn main:app --reload',
        start: 'uvicorn main:app',
      },
      configuration: {},
    });

    // Go/Gin Template
    this.templates.set('go-gin', {
      id: 'go-gin',
      name: 'Go + Gin',
      description: 'High-performance Go web framework with Gin',
      category: 'backend',
      language: 'go',
      framework: 'gin',
      files: [
        {
          path: 'go.mod',
          content: `module {{projectName}}

go 1.21

require github.com/gin-gonic/gin v1.9.1`,
        },
        {
          path: 'main.go',
          content: `package main

import (
    "github.com/gin-gonic/gin"
    "net/http"
)

func main() {
    r := gin.Default()

    r.GET("/", func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{
            "message": "Welcome to {{projectName}}",
        })
    })

    r.Run(":8080")
}`,
        },
        {
          path: '.gitignore',
          content: `# Binaries for programs and plugins
*.exe
*.exe~
*.dll
*.so
*.dylib

# Test binary, built with \`go test -c\`
*.test

# Output of the go coverage tool
*.out

# Dependency directories
vendor/`,
        },
      ],
      dependencies: [
        { name: 'github.com/gin-gonic/gin', version: 'v1.9.1', type: 'runtime' },
      ],
      devDependencies: [],
      scripts: {
        run: 'go run main.go',
        build: 'go build -o bin/main',
      },
      configuration: {},
    });

    // Rust/Actix Template
    this.templates.set('rust-actix', {
      id: 'rust-actix',
      name: 'Rust + Actix',
      description: 'High-performance Rust web framework with Actix',
      category: 'backend',
      language: 'rust',
      framework: 'actix',
      files: [
        {
          path: 'Cargo.toml',
          content: `[package]
name = "{{projectName}}"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4.4"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"`,
        },
        {
          path: 'src/main.rs',
          content: `use actix_web::{web, App, HttpServer, Responder};
use serde::Serialize;

#[derive(Serialize)]
struct Response {
    message: String,
}

async fn index() -> impl Responder {
    web::Json(Response {
        message: "Welcome to {{projectName}}".to_string(),
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .route("/", web::get().to(index))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}`,
        },
        {
          path: '.gitignore',
          content: `/target
**/*.rs.bk
Cargo.lock`,
        },
      ],
      dependencies: [
        { name: 'actix-web', version: '4.4', type: 'runtime' },
        { name: 'serde', version: '1.0', type: 'runtime' },
      ],
      devDependencies: [],
      scripts: {
        run: 'cargo run',
        build: 'cargo build',
        test: 'cargo test',
      },
      configuration: {},
    });
  }

  /**
   * Initialize default generators
   */
  private initializeDefaultGenerators(): void {
    // React Component Generator
    this.generators.set('react-component', {
      name: 'React Component',
      type: 'component',
      template: `import { useState } from 'react'

interface {{name}}Props {
  {{props}}
}

export function {{name}}({ {{props}} }: {{name}}Props) {
  const [state, setState] = useState(initialState)

  return (
    <div className="{{kebabName}}">
      {/* Component content */}
    </div>
  )
}`,
      options: [
        {
          name: 'name',
          type: 'string',
          description: 'Component name',
          required: true,
        },
        {
          name: 'props',
          type: 'string',
          description: 'Component props (comma-separated)',
          default: '',
          required: false,
        },
        {
          name: 'withStyles',
          type: 'boolean',
          description: 'Include CSS module',
          default: false,
          required: false,
        },
      ],
    });

    // Express Route Generator
    this.generators.set('express-route', {
      name: 'Express Route',
      type: 'service',
      template: `import express from 'express'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    // Implement GET logic
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/', async (req, res) => {
  try {
    // Implement POST logic
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router`,
      options: [
        {
          name: 'name',
          type: 'string',
          description: 'Route name',
          required: true,
        },
      ],
    });

    // Test Generator
    this.generators.set('test-file', {
      name: 'Test File',
      type: 'test',
      template: `import { describe, it, expect } from '@jest/globals'

describe('${name}', () => {
  it('should work correctly', () => {
    expect(true).toBe(true)
  })

  it('should handle edge cases', () => {
    // Add edge case tests
  })
})`,
      options: [
        {
          name: 'name',
          type: 'string',
          description: 'Test suite name',
          required: true,
        },
      ],
    });
  }

  /**
   * Get all templates
   */
  getTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values()).concat(Array.from(this.customTemplates.values()));
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): ProjectTemplate | undefined {
    return this.templates.get(id) || this.customTemplates.get(id);
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: ProjectTemplate['category']): ProjectTemplate[] {
    return this.getTemplates().filter(t => t.category === category);
  }

  /**
   * Add a custom template
   */
  addCustomTemplate(template: ProjectTemplate): void {
    this.customTemplates.set(template.id, template);
  }

  /**
   * Remove a custom template
   */
  removeCustomTemplate(id: string): void {
    this.customTemplates.delete(id);
  }

  /**
   * Scaffold a project from a template
   */
  async scaffoldProject(config: ScaffoldConfig): Promise<string[]> {
    const template = this.getTemplate(config.template);
    if (!template) {
      throw new Error(`Template ${config.template} not found`);
    }

    const createdFiles: string[] = [];
    const projectName = config.projectName;

    for (const file of template.files) {
      const content = this.interpolateTemplate(file.content, projectName, config.options);
      const filePath = `${config.destination}/${file.path}`;
      
      // In a real implementation, this would write to the file system
      console.log(`Creating file: ${filePath}`);
      createdFiles.push(filePath);
    }

    // Initialize git if requested
    if (config.gitInit) {
      console.log('Initializing git repository');
    }

    // Install dependencies if requested
    if (config.installDependencies) {
      console.log('Installing dependencies');
    }

    // Run post-install scripts if requested
    if (config.runPostInstall && template.postInstall) {
      for (const script of template.postInstall) {
        console.log(`Running post-install: ${script}`);
      }
    }

    return createdFiles;
  }

  /**
   * Generate code using a generator
   */
  generateCode(generatorId: string, options: Record<string, unknown>): string {
    const generator = this.generators.get(generatorId);
    if (!generator) {
      throw new Error(`Generator ${generatorId} not found`);
    }

    let code = generator.template;
    const name = String(options.name || 'Component');
    const kebabName = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const props = String(options.props || '');

    code = code.replace(/\${name}/g, name);
    code = code.replace(/\${kebabName}/g, kebabName);
    code = code.replace(/\${props}/g, props);

    return code;
  }

  /**
   * Get all generators
   */
  getGenerators(): Generator[] {
    return Array.from(this.generators.values());
  }

  /**
   * Get a generator by name
   */
  getGenerator(name: string): Generator | undefined {
    return this.generators.get(name);
  }

  /**
   * Add a custom generator
   */
  addGenerator(generator: Generator): void {
    this.generators.set(generator.name, generator);
  }

  /**
   * Remove a generator
   */
  removeGenerator(name: string): void {
    this.generators.delete(name);
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(content: string, projectName: string, options: Record<string, unknown>): string {
    let result = content;
    result = result.replace(/\{\{projectName\}\}/g, projectName);

    for (const [key, value] of Object.entries(options)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }

    return result;
  }

  /**
   * Validate scaffold configuration
   */
  validateConfig(config: ScaffoldConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.projectName) {
      errors.push('Project name is required');
    }

    if (!config.template) {
      errors.push('Template is required');
    }

    if (!this.getTemplate(config.template)) {
      errors.push(`Template ${config.template} not found`);
    }

    if (!config.destination) {
      errors.push('Destination is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Global scaffolding system instance
const scaffoldingSystem = new ProjectScaffoldingSystem();

export function getTemplates(): ProjectTemplate[] {
  return scaffoldingSystem.getTemplates();
}

export function getTemplate(id: string): ProjectTemplate | undefined {
  return scaffoldingSystem.getTemplate(id);
}

export function getTemplatesByCategory(category: ProjectTemplate['category']): ProjectTemplate[] {
  return scaffoldingSystem.getTemplatesByCategory(category);
}

export function addCustomTemplate(template: ProjectTemplate): void {
  scaffoldingSystem.addCustomTemplate(template);
}

export function removeCustomTemplate(id: string): void {
  scaffoldingSystem.removeCustomTemplate(id);
}

export async function scaffoldProject(config: ScaffoldConfig): Promise<string[]> {
  return scaffoldingSystem.scaffoldProject(config);
}

export function generateCode(generatorId: string, options: Record<string, unknown>): string {
  return scaffoldingSystem.generateCode(generatorId, options);
}

export function getGenerators(): Generator[] {
  return scaffoldingSystem.getGenerators();
}

export function getGenerator(name: string): Generator | undefined {
  return scaffoldingSystem.getGenerator(name);
}

export function addGenerator(generator: Generator): void {
  scaffoldingSystem.addGenerator(generator);
}

export function removeGenerator(name: string): void {
  scaffoldingSystem.removeGenerator(name);
}

export function validateConfig(config: ScaffoldConfig): { valid: boolean; errors: string[] } {
  return scaffoldingSystem.validateConfig(config);
}
