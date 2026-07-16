import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve(__dirname, '../shared/contracts/src');
const OUTPUT_FILE = path.resolve(__dirname, '../shared/contracts/python/contracts.py');

const FILES = [
  'common.ts',
  'auth.ts',
  'wayfinding.ts',
  'crowd.ts',
  'fan-assistance.ts',
  'tournament-ops.ts'
];

interface EnumDefinition {
  name: string;
  values: { key: string; val: string }[];
}

interface FieldDefinition {
  name: string;
  type: string;
  isOptional: boolean;
  comment?: string;
}

interface InterfaceDefinition {
  name: string;
  fields: FieldDefinition[];
  comment?: string;
  isGeneric?: boolean;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function translateType(tsType: string, fieldName: string): string {
  tsType = tsType.trim();

  // Handle arrays
  if (tsType.endsWith('[]')) {
    const inner = translateType(tsType.slice(0, -2), fieldName);
    return `list[${inner}]`;
  }
  if (tsType.startsWith('Array<')) {
    const inner = translateType(tsType.slice(6, -1), fieldName);
    return `list[${inner}]`;
  }

  // Handle records/dictionaries
  if (tsType.startsWith('Record<')) {
    const parts = tsType.slice(7, -1).split(',');
    const key = translateType(parts[0], fieldName);
    const val = translateType(parts.slice(1).join(','), fieldName);
    return `dict[${key}, ${val}]`;
  }

  // Handle unions
  if (tsType.includes('|')) {
    const parts = tsType.split('|').map(p => translateType(p, fieldName));
    if (parts.includes('None') || parts.includes('null')) {
      const nonNull = parts.filter(p => p !== 'None' && p !== 'null');
      if (nonNull.length === 1) {
        return `Optional[${nonNull[0]}]`;
      }
      return `Optional[Union[${nonNull.join(', ')}]]`;
    }
    return `Union[${parts.join(', ')}]`;
  }

  // Standard type mappings
  switch (tsType) {
    case 'string':
      return 'str';
    case 'boolean':
      return 'bool';
    case 'number':
      // Map known integer fields
      const lowerName = fieldName.toLowerCase();
      if (
        lowerName.includes('count') ||
        lowerName.includes('played') ||
        lowerName.includes('won') ||
        lowerName.includes('drawn') ||
        lowerName.includes('lost') ||
        lowerName.includes('goals') ||
        lowerName.includes('points') ||
        lowerName.includes('position') ||
        lowerName.includes('minute') ||
        lowerName.includes('score') ||
        lowerName.includes('seconds') ||
        lowerName.includes('port') ||
        lowerName.includes('limit') ||
        lowerName === 'level' ||
        lowerName === 'rating' ||
        lowerName === 'staffrequired' ||
        lowerName === 'stepnumber'
      ) {
        return 'int';
      }
      return 'float';
    case 'any':
      return 'Any';
    case 'null':
      return 'None';
    case 'void':
      return 'None';
    default:
      return tsType;
  }
}

function parseFile(content: string) {
  const enums: EnumDefinition[] = [];
  const interfaces: InterfaceDefinition[] = [];
  
  // Basic regex parser for enums
  const enumRegex = /export\s+enum\s+(\w+)\s*\{([^}]+)\}/g;
  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    const name = match[1];
    const rawValues = match[2];
    const values: { key: string; val: string }[] = [];
    const valRegex = /(\w+)\s*=\s*['"]([^'"]+)['"]/g;
    let vMatch;
    while ((vMatch = valRegex.exec(rawValues)) !== null) {
      values.push({ key: vMatch[1], val: vMatch[2] });
    }
    enums.push({ name, values });
  }

  // Basic regex parser for interfaces
  const interfaceRegex = /(?:\/\*\*([\s\S]*?)\*\/)?\s*export\s+interface\s+(\w+)(?:\s*<\s*\w+\s*>)?\s*\{([^}]+)\}/g;
  while ((match = interfaceRegex.exec(content)) !== null) {
    const comment = match[1]?.trim();
    const name = match[2];
    const rawBody = match[3];
    const isGeneric = match[0].includes('<T>');

    const fields: FieldDefinition[] = [];
    // Split by semicolons or newlines, ignoring comments
    const lines = rawBody.split(/;\n|;\r\n|;/);
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;
      
      const fieldMatch = /^(\w+)(\??)\s*:\s*([^;]+)$/.exec(line);
      if (fieldMatch) {
        const fName = fieldMatch[1];
        const isOptional = fieldMatch[2] === '?';
        const rawType = fieldMatch[3].trim();
        fields.push({
          name: fName,
          type: rawType,
          isOptional,
        });
      }
    }
    interfaces.push({ name, fields, comment, isGeneric });
  }

  return { enums, interfaces };
}

function main() {
  console.log('Generating python contracts mirror from TS source...');
  
  let allEnums: EnumDefinition[] = [];
  let allInterfaces: InterfaceDefinition[] = [];

  for (const file of FILES) {
    const filePath = path.join(SRC_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filePath} not found, skipping.`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const { enums, interfaces } = parseFile(content);
    allEnums = [...allEnums, ...enums];
    allInterfaces = [...allInterfaces, ...interfaces];
  }

  let pyCode = `"""
FIFA Nexus AI — Shared Contracts: Python Mirror
Zero-drift synchronization with TypeScript contracts.
GENERATED FILE - DO NOT EDIT DIRECTLY.
"""

from __future__ import annotations
from enum import Enum
from typing import Generic, TypeVar, Optional, Union, Any
from pydantic import BaseModel, Field, field_validator

T = TypeVar("T")

`;

  // Write enums
  for (const en of allEnums) {
    pyCode += `class ${en.name}(str, Enum):\n`;
    for (const v of en.values) {
      pyCode += `    ${v.key} = "${v.val}"\n`;
    }
    pyCode += `\n\n`;
  }

  // Write generic ApiResponse manually to handle generic typing cleanly
  const skipInterfaces = ['ApiResponse'];

  // Write interfaces
  for (const intf of allInterfaces) {
    if (skipInterfaces.includes(intf.name)) continue;

    if (intf.comment) {
      pyCode += `# ${intf.comment.replace(/\n\s*\*/g, '\n#')}\n`;
    }
    
    const baseClass = intf.isGeneric ? 'BaseModel, Generic[T]' : 'BaseModel';
    pyCode += `class ${intf.name}(${baseClass}):\n`;
    
    if (intf.fields.length === 0) {
      pyCode += `    pass\n\n`;
      continue;
    }

    let hasCamelFields = false;
    for (const f of intf.fields) {
      const pyName = camelToSnake(f.name);
      let pyType = translateType(f.type, f.name);
      if (f.isOptional && !pyType.startsWith('Optional[')) {
        pyType = `Optional[${pyType}]`;
      }
      
      const isCamel = pyName !== f.name;
      let fieldStr = '';
      if (isCamel) {
        hasCamelFields = true;
        const defaultVal = f.isOptional ? ' = None' : '';
        fieldStr = ` = Field(${f.isOptional ? 'None' : '...'}, alias="${f.name}")`;
      } else if (f.isOptional) {
        fieldStr = ' = None';
      }

      pyCode += `    ${pyName}: ${pyType}${fieldStr}\n`;
    }

    if (hasCamelFields) {
      pyCode += `\n    model_config = {"populate_by_name": True}\n`;
    }
    
    pyCode += `\n\n`;
  }

  // Append manual overrides / complex structures
  pyCode += `class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[ApiError] = None
    meta: Optional[ApiResponseMeta] = None


DEFAULT_RATE_LIMITS: dict[UserRole, dict[str, int]] = {
    UserRole.FAN: {"max_requests": 100, "window_seconds": 60},
    UserRole.STAFF: {"max_requests": 500, "window_seconds": 60},
    UserRole.ADMIN: {"max_requests": 1000, "window_seconds": 60},
}

ROLE_PERMISSIONS: dict[UserRole, list[str]] = {
    UserRole.FAN: [
        "route:calculate",
        "route:view",
        "zone:density:view",
        "stadium:map:view",
        "translate",
        "stadium:query",
        "feedback:submit",
    ],
    UserRole.STAFF: [
        "route:calculate",
        "route:view",
        "zone:density:view",
        "stadium:map:view",
        "translate",
        "stadium:query",
        "feedback:submit",
        "sensor:ingest",
        "prediction:view",
        "alert:view",
        "alert:acknowledge",
    ],
    UserRole.ADMIN: [
        "route:calculate",
        "route:view",
        "zone:density:view",
        "stadium:map:view",
        "stadium:map:update",
        "translate",
        "stadium:query",
        "feedback:submit",
        "feedback:view",
        "sensor:ingest",
        "prediction:view",
        "prediction:configure",
        "alert:view",
        "alert:acknowledge",
        "alert:configure",
        "user:manage",
        "system:configure",
    ],
}
`;

  fs.writeFileSync(OUTPUT_FILE, pyCode, 'utf-8');
  console.log(`Successfully generated Python contracts mirror at: ${OUTPUT_FILE}`);
}

main();
