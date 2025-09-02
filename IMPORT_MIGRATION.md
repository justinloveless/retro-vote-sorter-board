# Import Migration Guide

This guide explains how to migrate from `@/` alias imports to relative imports with file extensions.

## What Changed

- **Removed path aliases**: The `@/` alias configuration has been removed from TypeScript and Vite
- **Enforced relative imports**: All imports must now use relative paths
- **Required file extensions**: All imports must include the file extension (`.ts`, `.tsx`, `.js`, `.jsx`)

## Before (Old Style)
```typescript
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
```

## After (New Style)
```typescript
import { Button } from '../ui/button.tsx';
import { useAuth } from '../hooks/useAuth.tsx';
```

## Automatic Migration

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Run the conversion script**:
   ```bash
   npm run convert-imports
   ```

   This script will automatically:
   - Convert all `@/` imports to relative paths
   - Add appropriate file extensions
   - Calculate the correct relative path depth

3. **Fix any remaining issues**:
   ```bash
   npm run lint -- --fix
   ```

## Manual Migration Rules

If you need to manually convert imports:

1. **Calculate relative path**: Count how many directories you need to go up from the current file to reach the `src` directory
2. **Add file extension**: Always include the file extension (`.ts`, `.tsx`, `.js`, `.jsx`)
3. **Use relative paths**: Start with `../` for each directory level you need to go up

### Examples

**From `src/pages/Team.tsx` to `src/components/ui/button.tsx`:**
- Current location: `src/pages/` (depth 1)
- Target: `src/components/ui/`
- Relative path: `../components/ui/button.tsx`

**From `src/components/team/TeamHeader.tsx` to `src/hooks/useAuth.tsx`:**
- Current location: `src/components/team/` (depth 2)
- Target: `src/hooks/`
- Relative path: `../../hooks/useAuth.tsx`

## ESLint Rules

The following ESLint rules are now enforced:

- `no-restricted-imports`: Prevents `@/` alias usage
- `import/no-absolute-path`: Enforces relative imports
- `import/extensions`: Requires file extensions
- `@typescript-eslint/consistent-type-imports`: Enforces consistent type imports

## Benefits

- **Better tree-shaking**: Build tools can better analyze dependencies
- **Clearer dependencies**: Relative paths make it obvious where imports come from
- **Standard practice**: Follows modern JavaScript/TypeScript conventions
- **Better IDE support**: Many tools work better with relative imports

## Troubleshooting

### Import Resolution Issues
If you encounter import resolution issues after migration:

1. Check that file extensions are correct
2. Verify relative path calculations
3. Ensure target files exist
4. Run `npm run lint` to catch any remaining issues

### Build Errors
If the build fails:

1. Check the console for specific import errors
2. Verify all imports have correct file extensions
3. Ensure all relative paths are correct
4. Run the conversion script again if needed

## Rollback

If you need to rollback to the old system:

1. Restore the original `tsconfig.json` and `tsconfig.app.json` files
2. Restore the original `vite.config.ts` file
3. Restore the original `eslint.config.js` file
4. Revert any import changes in your source files

## Support

If you encounter issues during migration:

1. Check the ESLint output for specific error messages
2. Verify file paths and extensions
3. Ensure all dependencies are properly installed
4. Check that the conversion script ran successfully
