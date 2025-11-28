import React, { useState } from 'react';
import {
  Modal,
  ModalVariant,
  ModalBody,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  TextInput,
  NumberInput,
  Checkbox,
  Select,
  SelectOption,
  SelectList,
  MenuToggle,
  Alert,
  HelperText,
  HelperTextItem
} from '@patternfly/react-core';
import { useForm, Controller } from 'react-hook-form';
import { DemoDefinition } from '../lib/types';
import { createInstance } from '../lib/instances';
import { loadConfig } from '../lib/config';

interface LaunchModalProps {
  demo: DemoDefinition;
  isOpen: boolean;
  onClose: () => void;
}

export const LaunchModal: React.FC<LaunchModalProps> = ({ demo, isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectOpenStates, setSelectOpenStates] = useState<Record<string, boolean>>({});
  const { control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: Object.fromEntries(
      demo.parameters.map(param => [param.name, param.default ?? ''])
    )
  });

  const onSubmit = async (data: Record<string, any>) => {
    setLoading(true);
    setError(null);

    try {
      const config = await loadConfig();
      const instanceId = await createInstance(demo, data, config);
      onClose();
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to create instance');
    } finally {
      setLoading(false);
    }
  };

  const renderParameterInput = (param: DemoDefinition['parameters'][0], index: number) => {
    const name = param.name;

    switch (param.type) {
      case 'text':
        return (
          <Controller
            key={index}
            name={name}
            control={control}
            rules={{ required: param.default === undefined }}
            render={({ field }) => (
              <FormGroup
                label={param.label || param.name}
                isRequired={param.default === undefined}
                fieldId={name}
              >
                <TextInput
                  id={name}
                  value={field.value || ''}
                  onChange={(_, value) => field.onChange(value)}
                  validated={errors[name] ? 'error' : 'default'}
                />
                {errors[name] && (
                  <HelperText>
                    <HelperTextItem variant="error">This field is required</HelperTextItem>
                  </HelperText>
                )}
              </FormGroup>
            )}
          />
        );

      case 'number':
        return (
          <Controller
            key={index}
            name={name}
            control={control}
            rules={{ required: param.default === undefined }}
            render={({ field }) => (
              <FormGroup
                label={param.label || param.name}
                isRequired={param.default === undefined}
                fieldId={name}
              >
                <NumberInput
                  id={name}
                  value={Number(field.value) || 0}
                  onMinus={() => field.onChange((Number(field.value) || 0) - 1)}
                  onChange={(event) => {
                    const value = (event.target as HTMLInputElement).value;
                    field.onChange(value ? Number(value) : '');
                  }}
                  onPlus={() => field.onChange((Number(field.value) || 0) + 1)}
                />
                {errors[name] && (
                  <HelperText>
                    <HelperTextItem variant="error">This field is required</HelperTextItem>
                  </HelperText>
                )}
              </FormGroup>
            )}
          />
        );

      case 'boolean':
        return (
          <Controller
            key={index}
            name={name}
            control={control}
            render={({ field }) => (
              <FormGroup fieldId={name}>
                <Checkbox
                  id={name}
                  label={param.label || param.name}
                  isChecked={field.value === true}
                  onChange={(_, checked) => field.onChange(checked)}
                />
              </FormGroup>
            )}
          />
        );

      case 'select':
        return (
          <Controller
            key={index}
            name={name}
            control={control}
            rules={{ required: param.default === undefined }}
            render={({ field }) => {
              const isOpen = selectOpenStates[name] || false;
              const selectedLabel = param.options?.find(opt => opt === field.value) || 'Select an option';
              return (
                <FormGroup
                  label={param.label || param.name}
                  isRequired={param.default === undefined}
                  fieldId={name}
                >
                  <Select
                    id={name}
                    selected={field.value}
                    onSelect={(_, value) => {
                      field.onChange(value);
                      setSelectOpenStates({ ...selectOpenStates, [name]: false });
                    }}
                    isOpen={isOpen}
                    onOpenChange={(open) => setSelectOpenStates({ ...selectOpenStates, [name]: open })}
                    toggle={(toggleRef) => (
                      <MenuToggle ref={toggleRef} onClick={() => setSelectOpenStates({ ...selectOpenStates, [name]: !isOpen })} isExpanded={isOpen}>
                        {selectedLabel}
                      </MenuToggle>
                    )}
                  >
                    <SelectList>
                      {param.options?.map((option, optIndex) => (
                        <SelectOption key={optIndex} value={option}>
                          {option}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                  {errors[name] && (
                    <HelperText>
                      <HelperTextItem variant="error">This field is required</HelperTextItem>
                    </HelperText>
                  )}
                </FormGroup>
              );
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      variant={ModalVariant.medium}
      title={`Launch Demo: ${demo.name}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalBody>
        <Form>
          {error && (
            <Alert variant="danger" title={error} isInline style={{ marginBottom: '1rem' }} />
          )}
          {demo.parameters.map((param, index) => renderParameterInput(param, index))}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={handleSubmit(onSubmit)}
          isDisabled={loading}
        >
          {loading ? 'Launching...' : 'Launch'}
        </Button>
        <Button variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

