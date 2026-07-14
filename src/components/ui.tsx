import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from './theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const variantStyle =
    variant === 'primary'
      ? styles.btnPrimary
      : variant === 'outline'
        ? styles.btnOutline
        : variant === 'destructive'
          ? styles.btnDestructive
          : styles.btnGhost;

  const sizeStyle =
    size === 'sm' ? styles.btnSm : size === 'lg' ? styles.btnLg : styles.btnMd;

  const textColor =
    variant === 'primary' ? '#fff' : variant === 'destructive' ? '#fff' : colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.btn, variantStyle, sizeStyle, disabled && styles.btnDisabled, style]}
    >
      <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  error,
  multiline,
  numberOfLines,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
}) {
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={[styles.input, error ? styles.inputError : null, multiline ? styles.inputMultiline : null]}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

import { TextInput } from 'react-native';

export function Select({
  label,
  value,
  onValueChange,
  options,
  placeholder,
}: {
  label?: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.selectContainer}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onValueChange(opt.value)}
            style={[styles.selectOption, value === opt.value && styles.selectOptionActive]}
          >
            <Text
              style={[
                styles.selectOptionText,
                value === opt.value && styles.selectOptionTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export function Dropdown({
  label,
  value,
  onValueChange,
  options,
  placeholder,
}: {
  label?: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.dropdown} onPress={() => setOpen(!open)}>
        <Text style={[styles.dropdownText, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholder || 'Sélectionner...'}
        </Text>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdownList}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => {
                onValueChange(opt.value);
                setOpen(false);
              }}
              style={styles.dropdownItem}
            >
              <Text style={styles.dropdownItemText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export function Modal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!visible) return null;
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
        {children}
      </View>
    </View>
  );
}

export function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color?: string;
  bg?: string;
}) {
  return (
    <View style={[styles.badge, bg ? { backgroundColor: bg } : null]}>
      <Text style={[styles.badgeText, color ? { color } : null]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({
  progress,
  color,
}: {
  progress: number;
  color?: string;
}) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: color || colors.primary },
        ]}
      />
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

export function LoadingSpinner() {
  return (
    <View style={styles.spinnerContainer}>
      <View style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  btn: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  btnDestructive: {
    backgroundColor: colors.destructive,
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnSm: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  btnMd: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  btnLg: {
    paddingVertical: 16,
    paddingHorizontal: 28,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 14,
  zIndex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.input,
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.destructive,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 12,
    marginTop: 4,
  },
  selectContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  selectOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.input,
  },
  selectOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  selectOptionText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  selectOptionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.input,
  },
  dropdownText: {
    fontSize: 15,
    color: colors.text,
  },
  placeholder: {
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 10,
    color: colors.textMuted,
  },
  dropdownList: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    maxHeight: 200,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemText: {
    fontSize: 15,
    color: colors.text,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalClose: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
  alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  spinnerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  spinner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.border,
    borderTopColor: colors.primary,
  },
});
