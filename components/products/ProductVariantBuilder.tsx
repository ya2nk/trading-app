'use client';

import { useState } from 'react';
import { Plus, Trash2, Copy, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface VariantAttribute {
  key: string;
  value: string;
}

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
  image_url?: string;
  sort_order: number;
}

interface ProductVariantBuilderProps {
  initialVariants?: ProductVariant[];
  onVariantsChange: (variants: ProductVariant[]) => void;
  skuPrefix?: string;
}

export function ProductVariantBuilder({ 
  initialVariants = [],
  onVariantsChange,
  skuPrefix
}: ProductVariantBuilderProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);

  const generateSKU = (variantName: string) => {
    if (!skuPrefix) return `SKU-${Date.now()}`;
    const cleanName = variantName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${skuPrefix}-${cleanName}`;
  };

  const addVariant = () => {
    const newVariant: ProductVariant = {
      id: crypto.randomUUID(),
      name: `Variant ${variants.length + 1}`,
      sku: generateSKU(`variant-${variants.length + 1}`),
      price: 0,
      stock: 0,
      attributes: {},
      sort_order: variants.length
    };
    const updated = [...variants, newVariant];
    setVariants(updated);
    onVariantsChange(updated);
  };

  const updateVariant = (index: number, updates: Partial<ProductVariant>) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], ...updates };
    setVariants(updated);
    onVariantsChange(updated);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
    onVariantsChange(variants.filter((_, i) => i !== index));
  };

  const duplicateVariant = (index: number) => {
    const duplicated = {
      ...variants[index],
      id: crypto.randomUUID(),
      name: `${variants[index].name} (Copy)`,
      sku: generateSKU(`${variants[index].name}-copy`),
      stock: 0, // Start with 0 for safety
      sort_order: variants.length
    };
    const newVariants = [...variants];
    newVariants.splice(index + 1, 0, duplicated);
    setVariants(newVariants);
    onVariantsChange(newVariants);
  };

  const moveVariant = (fromIndex: number, toIndex: number) => {
    const newVariants = [...variants];
    const [moved] = newVariants.splice(fromIndex, 1);
    newVariants.splice(toIndex, 0, moved);
    
    // Update sort orders
    const reordered = newVariants.map((v, i) => ({ ...v, sort_order: i }));
    setVariants(reordered);
    onVariantsChange(reordered);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>Product Variants</span>
            <Badge variant="secondary">{variants.length}</Badge>
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create multiple variants with different prices and stock
          </p>
        </div>
        
        <Button type="button" onClick={addVariant} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Variant
        </Button>
      </div>

      {variants.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">No variants yet</p>
          <p className="text-sm text-muted-foreground mt-1">Click &quot;Add Variant&quot; to start</p>
        </div>
      )}

      <div className="space-y-4">
        {variants.map((variant, index) => (
          <VariantRow
            key={variant.id}
            variant={variant}
            index={index}
            skuPrefix={skuPrefix}
            onUpdate={(updates) => updateVariant(index, updates)}
            onDelete={() => removeVariant(index)}
            onDuplicate={() => duplicateVariant(index)}
            onMoveUp={() => index > 0 && moveVariant(index, index - 1)}
            onMoveDown={() => index < variants.length - 1 && moveVariant(index, index + 1)}
            isLast={index === variants.length - 1}
            isMoving={false}
          />
        ))}
      </div>
    </div>
  );
}

function VariantRow({
  variant,
  index,
  skuPrefix,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  isLast,
  isMoving
}: {
  variant: ProductVariant;
  index: number;
  skuPrefix?: string;
  onUpdate: (updates: Partial<ProductVariant>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isLast: boolean;
  isMoving: boolean;
}) {
  return (
    <Card className={`border-l-4 border-l-primary transition-all hover:shadow-md ${isMoving ? 'opacity-50' : ''}`}>
      <CardContent className="p-6 space-y-4">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-5 h-5 text-muted-foreground" />
            </div>
            <Badge variant="outline" className="font-mono">
              {variant.sku}
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onDuplicate}
            >
              <Copy className="w-4 h-4 mr-1" />
              Duplicate
            </Button>
            
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onMoveUp}
                disabled={index === 0}
              >
                ↑
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onMoveDown}
                disabled={isLast}
              >
                ↓
              </Button>
            </div>
            
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Main Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor={`variant-name-${index}`}>Variant Name</Label>
            <Input
              id={`variant-name-${index}`}
              value={variant.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="e.g., Size M - Red"
            />
          </div>

          <div>
            <Label htmlFor={`variant-sku-${index}`}>SKU</Label>
            <Input
              id={`variant-sku-${index}`}
              value={variant.sku}
              onChange={(e) => onUpdate({ sku: e.target.value })}
              placeholder="Unique SKU"
            />
          </div>

          <div>
            <Label htmlFor={`variant-price-${index}`}>Price (Rp)</Label>
            <div className="relative">
              <Input
                id={`variant-price-${index}`}
                type="number"
                value={variant.price}
                onChange={(e) => onUpdate({ price: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                IDR
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor={`variant-stock-${index}`}>Stock</Label>
            <Input
              id={`variant-stock-${index}`}
              type="number"
              value={variant.stock}
              onChange={(e) => onUpdate({ stock: parseInt(e.target.value) || 0 })}
              min="0"
            />
          </div>
        </div>

        {/* Attributes Section */}
        <VariantAttributesSection
          attributes={variant.attributes}
          onChange={(attrs) => onUpdate({ attributes: attrs })}
        />
      </CardContent>
    </Card>
  );
}

function VariantAttributesSection({
  attributes,
  onChange
}: {
  attributes?: Record<string, string>;
  onChange: (attributes: Record<string, string>) => void;
}) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const addAttribute = () => {
    if (!newKey.trim()) return;
    onChange({
      ...(attributes || {}),
      [newKey]: newValue || ''
    });
    setNewKey('');
    setNewValue('');
  };

  const removeAttribute = (key: string) => {
    const updated = { ...attributes };
    delete updated[key];
    onChange(updated);
  };

  const updateAttribute = (key: string, value: string) => {
    onChange({
      ...(attributes || {}),
      [key]: value
    });
  };

  const presetOptions = ['Size', 'Color', 'Material', 'Weight', 'Volume', 'Design'];

  return (
    <div className="space-y-3">
      <Label className="text-sm">Attributes (Optional)</Label>
      
      {/* Preset Quick Add */}
      <div className="flex gap-2">
        {presetOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setNewKey(option);
              setNewValue('');
            }}
            className="text-xs px-2 py-1 bg-muted hover:bg-accent rounded transition-colors"
          >
            {option}
          </button>
        ))}
      </div>

      {/* Add Attribute Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Attribute Name"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="flex-1"
        />
        <Button type="button" onClick={addAttribute}>Add</Button>
      </div>

      {/* Display Selected Attributes */}
      {attributes && Object.keys(attributes).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(attributes).map(([key, value]) => (
            <Badge key={key} variant="secondary" className="px-3 py-1">
              {key}: {value}
              <button
                type="button"
                onClick={() => removeAttribute(key)}
                className="ml-2 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
