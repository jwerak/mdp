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
import { createInstance, executeInstance, updateInstanceStatus } from '../lib/instances';
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

    let instanceId: string | null = null;

    try {
      const config = await loadConfig();
      instanceId = await createInstance(demo, data, config);
      console.log('Instance created:', instanceId);

      // Automatically execute the instance after creation
      try {
        await executeInstance(instanceId, (output) => {
          console.log('Execution output:', output);
        });
        // Success - reload to show the instance
        onClose();
        window.location.reload();
      } catch (execErr: any) {
        // If execution fails, update instance status to failed and show in list
        console.error('Failed to execute instance:', execErr);
        const errorMessage = execErr?.message || execErr?.toString() || 'Execution failed';
        const errorOutput = execErr?.message || 'Failed to start execution';

        try {
          await updateInstanceStatus(instanceId, {
            state: 'failed',
            error: errorMessage,
            output: errorOutput,
            completedAt: new Date().toISOString()
          });
          console.log('Instance status updated to failed:', instanceId);
        } catch (statusErr: any) {
          console.error('Failed to update instance status:', statusErr);
          // Even if status update fails, try to show the instance
        }

        // Wait a bit to ensure status is written, then reload
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 500);
      }
    } catch (err: any) {
      console.error('Failed to create instance:', err);
      // If instance creation failed, show error but don't reload
      setError(err.message || 'Failed to create instance');
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
            rules={{ required: param.required }}
            render={({ field }) => (
              <FormGroup
                label={param.label || param.name}
                isRequired={param.required}
                fieldId={name}
              >
                <TextInput
                  id={name}
                  value={field.value || ''}
                  onChange={(_, value) => field.onChange(value)}
                  validated={errors[name] ? 'error' : 'default'}
                />
                {param.description && (
                  <HelperText>
                    <HelperTextItem>{param.description}</HelperTextItem>
                  </HelperText>
                )}
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
            rules={{ required: param.required }}
            render={({ field }) => (
              <FormGroup
                label={param.label || param.name}
                isRequired={param.required}
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
                {param.description && (
                  <HelperText>
                    <HelperTextItem>{param.description}</HelperTextItem>
                  </HelperText>
                )}
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
                {param.description && (
                  <HelperText>
                    <HelperTextItem>{param.description}</HelperTextItem>
                  </HelperText>
                )}
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
            rules={{ required: param.required }}
            render={({ field }) => {
              const isOpen = selectOpenStates[name] || false;
              const selectedLabel = param.options?.find(opt => opt === field.value) || 'Select an option';
              return (
                <FormGroup
                  label={param.label || param.name}
                  isRequired={param.required}
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
                  {param.description && (
                    <HelperText>
                      <HelperTextItem>{param.description}</HelperTextItem>
                    </HelperText>
                  )}
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

