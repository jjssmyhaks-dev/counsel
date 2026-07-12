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
  onSubmit: (data: { name: string; clientName: string; description: string; practiceArea: string }) => Promise<void>;
}

const PRACTICE_AREAS = [
  { value: '', label: 'Select practice area...' },
  { value: 'Corporate M&A', label: 'Corporate M&A' },
  { value: 'Intellectual Property', label: 'Intellectual Property' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Employment Law', label: 'Employment Law' },
  { value: 'Privacy & Data Protection', label: 'Privacy & Data Protection' },
  { value: 'Litigation', label: 'Litigation' },
  { value: 'Tax', label: 'Tax' },
  { value: 'Banking & Finance', label: 'Banking & Finance' },
];

export function MatterForm({ open, onClose, onSubmit }: MatterFormProps) {
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [practiceArea, setPracticeArea] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Matter name is required';
    if (!clientName.trim()) e.clientName = 'Client name is required';
    if (!description.trim()) e.description = 'Description is required';
    if (!practiceArea) e.practiceArea = 'Practice area is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({ name, clientName, description, practiceArea });
      setName('');
      setClientName('');
      setDescription('');
      setPracticeArea('');
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
          label="Practice Area"
          options={PRACTICE_AREAS}
          value={practiceArea}
          onChange={(e) => setPracticeArea(e.target.value)}
          error={errors.practiceArea}
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
