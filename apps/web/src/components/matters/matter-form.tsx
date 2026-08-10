'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select } from '../ui/select';

interface MatterFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; clientName: string; description: string; type: string }) => Promise<void>;
}

const TYPE_OPTIONS = [
  { value: '', label: 'Select type...' },
  { value: 'LEGAL', label: 'Legal' },
  { value: 'CONSULTING', label: 'Consulting' },
];

export function MatterForm({ open, onClose, onSubmit }: MatterFormProps) {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [matterType, setMatterType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Matter name is required';
    if (!clientName.trim()) e.clientName = 'Client name is required';
    if (!description.trim()) e.description = 'Description is required';
    if (!matterType) e.matterType = 'Type is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({ name, clientName, description, type: matterType });
      setName('');
      setClientName('');
      setDescription('');
      setMatterType('');
      onClose();
    } catch {
      // Error handled by parent
    }
    setSubmitting(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Matter"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting}>
            Create Matter
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Matter Name"
          placeholder="e.g., In re Quantum Dynamics Merger"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <Input
          label="Client Name"
          placeholder="e.g., Quantum Dynamics Inc."
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          error={errors.clientName}
        />
        <Select
          label="Type"
          options={TYPE_OPTIONS}
          value={matterType}
          onChange={(e) => setMatterType(e.target.value)}
          error={errors.matterType}
        />
        <Textarea
          label="Description"
          placeholder="Brief description of the matter..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          rows={3}
        />
      </div>
    </Modal>
  );
}
