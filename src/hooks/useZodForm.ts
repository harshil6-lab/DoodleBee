/**
 * React Hook Form + Zod foundation (ProjectDocs 02 section 10, ADR D02-013/014).
 *
 * Complex validated forms (nickname, create-room, join-room) use this hook so
 * validation rules come from a single Zod schema. Simple controls do not need
 * form abstraction and should not use this hook.
 *
 * The hook models the schema input and returns the schema output, which is what
 * `zodResolver` produces for Zod 4 schemas that transform their input.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useForm,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
import type { ZodType } from 'zod';

export function useZodForm<
  TInput extends FieldValues,
  TOutput extends FieldValues = TInput,
>(
  schema: ZodType<TOutput, TInput>,
  options?: Omit<UseFormProps<TInput, unknown, TOutput>, 'resolver'>,
): UseFormReturn<TInput, unknown, TOutput> {
  return useForm<TInput, unknown, TOutput>({
    ...options,
    resolver: zodResolver(schema),
  });
}
