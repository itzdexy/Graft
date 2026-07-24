import { c as _c } from "react/compiler-runtime";
import capitalize from 'lodash-es/capitalize.js';
import * as React from 'react';
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useExitOnCtrlCDWithKeybindings } from 'src/hooks/useExitOnCtrlCDWithKeybindings.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { FAST_MODE_MODEL_DISPLAY, isFastModeAvailable, isFastModeCooldown, isFastModeEnabled } from 'src/utils/fastMode.js';
import { Box, Text } from '../ink.js';
import { useKeybindings } from '../keybindings/useKeybinding.js';
import { useAppState, useSetAppState } from '../state/AppState.js';
import { convertEffortValueToLevel, type EffortLevel, getDefaultEffortForModel, modelSupportsEffort, modelSupportsMaxEffort, resolvePickerEffortPersistence, toPersistableEffort } from '../utils/effort.js';
import { getDefaultMainLoopModel, type ModelSetting, modelDisplayString, parseUserSpecifiedModel } from '../utils/model/model.js';
import { getModelOptions, type ModelOption } from '../utils/model/modelOptions.js';
import { getSettingsForSource, updateSettingsForSource } from '../utils/settings/settings.js';
import { getProductName } from '../utils/blinkBrand.js';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js';
import { Select } from './CustomSelect/index.js';
import { Byline } from './design-system/Byline.js';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js';
import { Pane } from './design-system/Pane.js';
import { effortLevelToSymbol } from './EffortIndicator.js';
import { stringWidth } from '../ink/stringWidth.js';

export type Props = {
  initial: string | null;
  sessionModel?: ModelSetting;
  onSelect: (model: string | null, effort: EffortLevel | undefined) => void;
  onCancel?: () => void;
  isStandaloneCommand?: boolean;
  showFastModeNotice?: boolean;
  /** Overrides the dim header line below "Select model". */
  headerText?: string;
  skipSettingsWrite?: boolean;
};

const NO_PREFERENCE = '__NO_PREFERENCE__';

type ProviderGroup = {
  provider: string;
  models: ModelOption[];
};

function groupByProvider(options: ModelOption[]): ProviderGroup[] {
  const groups = new Map<string, ModelOption[]>();
  for (const opt of options) {
    const label = opt.label;
    let provider = 'Other';
    const lowerLabel = label.toLowerCase();
    if (lowerLabel.includes('sonnet') || lowerLabel.includes('opus') || lowerLabel.includes('haiku')) {
      provider = 'Anthropic';
    } else if (lowerLabel.includes('gpt') || lowerLabel.includes('o1') || lowerLabel.includes('o3') || lowerLabel.includes('o4')) {
      provider = 'OpenAI';
    } else if (lowerLabel.includes('gemini') || lowerLabel.includes('gemma')) {
      provider = 'Google';
    } else if (lowerLabel.includes('deepseek')) {
      provider = 'DeepSeek';
    } else if (lowerLabel.includes('llama') || lowerLabel.includes('codellama')) {
      provider = 'Meta';
    } else if (lowerLabel.includes('qwen') || lowerLabel.includes('coder')) {
      provider = 'Alibaba';
    } else if (lowerLabel.includes('mistral') || lowerLabel.includes('mixtral')) {
      provider = 'Mistral';
    } else if (lowerLabel.includes('default') || lowerLabel.includes('recommended')) {
      provider = 'Default';
    }
    if (!groups.has(provider)) groups.set(provider, []);
    groups.get(provider)!.push(opt);
  }
  return Array.from(groups.entries()).map(([provider, models]) => ({ provider, models }));
}

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const lower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < queryLower.length; i++) {
    if (lower[i] === queryLower[qi]) qi++;
  }
  return qi === queryLower.length;
}

function EffortLevelIndicator(t0) {
  const $ = _c(5);
  const { effort } = t0;
  const color = effort ? "claude" : "subtle";
  const val = effort ?? "low";
  let symbol;
  if ($[0] !== val) {
    symbol = effortLevelToSymbol(val);
    $[0] = val;
    $[1] = symbol;
  } else {
    symbol = $[1];
  }
  let result;
  if ($[2] !== color || $[3] !== symbol) {
    result = <Text color={color}>{symbol}</Text>;
    $[2] = color;
    $[3] = symbol;
    $[4] = result;
  } else {
    result = $[4];
  }
  return result;
}

function resolveOptionModel(value?: string): string | undefined {
  if (!value) return undefined;
  return value === NO_PREFERENCE ? getDefaultMainLoopModel() : parseUserSpecifiedModel(value);
}

function cycleEffortLevel(current: EffortLevel, direction: 'left' | 'right', includeMax: boolean): EffortLevel {
  const levels: EffortLevel[] = includeMax ? ['low', 'medium', 'high', 'max'] : ['low', 'medium', 'high'];
  const idx = levels.indexOf(current);
  const currentIndex = idx !== -1 ? idx : levels.indexOf('high');
  if (direction === 'right') {
    return levels[(currentIndex + 1) % levels.length]!;
  } else {
    return levels[(currentIndex - 1 + levels.length) % levels.length]!;
  }
}

function getDefaultEffortLevelForOption(value?: string): EffortLevel {
  const resolved = resolveOptionModel(value) ?? getDefaultMainLoopModel();
  const defaultValue = getDefaultEffortForModel(resolved);
  return defaultValue !== undefined ? convertEffortValueToLevel(defaultValue) : 'high';
}

export function ModelPicker(t0) {
  const $ = _c(82);
  const {
    initial,
    sessionModel,
    onSelect,
    onCancel,
    isStandaloneCommand,
    showFastModeNotice,
    headerText,
    skipSettingsWrite
  } = t0;
  const setAppState = useSetAppState();
  const exitState = useExitOnCtrlCDWithKeybindings();
  const initialValue = initial === null ? NO_PREFERENCE : initial;
  const [focusedValue, setFocusedValue] = useState(initialValue);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<string>('');
  const isFastMode = useAppState(_temp);
  const [hasToggledEffort, setHasToggledEffort] = useState(false);
  const effortValue = useAppState(_temp2);
  let t1;
  if ($[0] !== effortValue) {
    t1 = effortValue !== undefined ? convertEffortValueToLevel(effortValue) : undefined;
    $[0] = effortValue;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const [effort, setEffort] = useState(t1);
  const t2 = isFastMode ?? false;
  let t3;
  if ($[2] !== t2) {
    t3 = getModelOptions(t2);
    $[2] = t2;
    $[3] = t3;
  } else {
    t3 = $[3];
  }
  const modelOptions = t3;

  let t4;
  bb0: {
    if (initial !== null && !modelOptions.some(opt => opt.value === initial)) {
      let t5;
      if ($[4] !== initial) {
        t5 = modelDisplayString(initial);
        $[4] = initial;
        $[5] = t5;
      } else {
        t5 = $[5];
      }
      let t6;
      if ($[6] !== initial || $[7] !== t5) {
        t6 = { value: initial, label: t5, description: "Current model" };
        $[6] = initial;
        $[7] = t5;
        $[8] = t6;
      } else {
        t6 = $[8];
      }
      let t7;
      if ($[9] !== modelOptions || $[10] !== t6) {
        t7 = [...modelOptions, t6];
        $[9] = modelOptions;
        $[10] = t6;
        $[11] = t7;
      } else {
        t7 = $[11];
      }
      t4 = t7;
      break bb0;
    }
    t4 = modelOptions;
  }
  const optionsWithInitial = t4;

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return optionsWithInitial;
    return optionsWithInitial.filter(opt =>
      fuzzyMatch(opt.label, searchQuery) ||
      fuzzyMatch(opt.description, searchQuery) ||
      fuzzyMatch(String(opt.value ?? ''), searchQuery)
    );
  }, [optionsWithInitial, searchQuery]);

  const providerGroups = useMemo(() => groupByProvider(filteredOptions), [filteredOptions]);
  const flatFiltered = useMemo(() => filteredOptions.map(opt => ({
    ...opt,
    value: opt.value === null ? NO_PREFERENCE : opt.value
  })), [filteredOptions]);
  const selectOptions = flatFiltered;

  let t6;
  if ($[14] !== initialValue || $[15] !== selectOptions) {
    t6 = selectOptions.some(_ => _.value === initialValue) ? initialValue : selectOptions[0]?.value ?? undefined;
    $[14] = initialValue;
    $[15] = selectOptions;
    $[16] = t6;
  } else {
    t6 = $[16];
  }
  const initialFocusValue = t6;
  const visibleCount = Math.min(12, selectOptions.length);
  const hiddenCount = Math.max(0, selectOptions.length - visibleCount);

  let t7;
  if ($[17] !== focusedValue || $[18] !== selectOptions) {
    t7 = selectOptions.find(opt_1 => opt_1.value === focusedValue)?.label;
    $[17] = focusedValue;
    $[18] = selectOptions;
    $[19] = t7;
  } else {
    t7 = $[19];
  }
  const focusedModelName = t7;

  let focusedSupportsEffort;
  let t8;
  if ($[20] !== focusedValue) {
    const focusedModel = resolveOptionModel(focusedValue);
    focusedSupportsEffort = focusedModel ? modelSupportsEffort(focusedModel) : false;
    t8 = focusedModel ? modelSupportsMaxEffort(focusedModel) : false;
    $[20] = focusedValue;
    $[21] = focusedSupportsEffort;
    $[22] = t8;
  } else {
    focusedSupportsEffort = $[21];
    t8 = $[22];
  }
  const focusedSupportsMax = t8;

  let t9;
  if ($[23] !== focusedValue) {
    t9 = getDefaultEffortLevelForOption(focusedValue);
    $[23] = focusedValue;
    $[24] = t9;
  } else {
    t9 = $[24];
  }
  const focusedDefaultEffort = t9;
  const displayEffort = effort === "max" && !focusedSupportsMax ? "high" : effort;

  let t10;
  if ($[25] !== effortValue || $[26] !== hasToggledEffort) {
    t10 = value => {
      setFocusedValue(value);
      if (!hasToggledEffort && effortValue === undefined) {
        setEffort(getDefaultEffortLevelForOption(value));
      }
    };
    $[25] = effortValue;
    $[26] = hasToggledEffort;
    $[27] = t10;
  } else {
    t10 = $[27];
  }
  const handleFocus = t10;

  let t11;
  if ($[28] !== focusedDefaultEffort || $[29] !== focusedSupportsEffort || $[30] !== focusedSupportsMax) {
    t11 = direction => {
      if (!focusedSupportsEffort) return;
      setEffort(prev => cycleEffortLevel(prev ?? focusedDefaultEffort, direction, focusedSupportsMax));
      setHasToggledEffort(true);
    };
    $[28] = focusedDefaultEffort;
    $[29] = focusedSupportsEffort;
    $[30] = focusedSupportsMax;
    $[31] = t11;
  } else {
    t11 = $[31];
  }
  const handleCycleEffort = t11;

  let t12;
  if ($[32] !== handleCycleEffort) {
    t12 = {
      "modelPicker:decreaseEffort": () => handleCycleEffort("left"),
      "modelPicker:increaseEffort": () => handleCycleEffort("right")
    };
    $[32] = handleCycleEffort;
    $[33] = t12;
  } else {
    t12 = $[33];
  }

  let t13;
  if ($[34] === Symbol.for("react.memo_cache_sentinel")) {
    t13 = { context: "ModelPicker" };
    $[34] = t13;
  } else {
    t13 = $[34];
  }
  useKeybindings(t12, t13);

  let t14;
  if ($[35] !== effort || $[36] !== hasToggledEffort || $[37] !== onSelect || $[38] !== setAppState || $[39] !== skipSettingsWrite) {
    t14 = function handleSelect(value_0) {
      logEvent("tengu_model_command_menu_effort", {
        effort: effort as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      if (!skipSettingsWrite) {
        const effortLevel = resolvePickerEffortPersistence(effort, getDefaultEffortLevelForOption(value_0), getSettingsForSource("userSettings")?.effortLevel, hasToggledEffort);
        const persistable = toPersistableEffort(effortLevel);
        if (persistable !== undefined) {
          updateSettingsForSource("userSettings", { effortLevel: persistable });
        }
        setAppState(prev_0 => ({ ...prev_0, effortValue: effortLevel }));
      }
      const selectedModel = resolveOptionModel(value_0);
      const selectedEffort = hasToggledEffort && selectedModel && modelSupportsEffort(selectedModel) ? effort : undefined;
      if (value_0 === NO_PREFERENCE) {
        onSelect(null, selectedEffort);
        return;
      }
      onSelect(value_0, selectedEffort);
    };
    $[35] = effort;
    $[36] = hasToggledEffort;
    $[37] = onSelect;
    $[38] = setAppState;
    $[39] = skipSettingsWrite;
    $[40] = t14;
  } else {
    t14 = $[40];
  }
  const handleSelect = t14;

  const groupCount = providerGroups.length;

  let t15;
  if ($[41] !== t16) {
    t15 = t16;
    $[41] = t15;
  } else {
    t15 = $[41];
  }

  let t26;
  if ($[42] !== t16) {
    t26 = t16;
    $[42] = t26;
  } else {
    t26 = $[42];
  }

  let t17;
  if ($[44] !== sessionModel) {
    t17 = sessionModel && <Text dimColor={true}>Currently using {modelDisplayString(sessionModel)} for this session (set by plan mode). Selecting a model will undo this.</Text>;
    $[44] = sessionModel;
    $[45] = t17;
  } else {
    t17 = $[45];
  }

  let t18;
  if ($[46] !== filteredOptions.length || $[47] !== searchQuery) {
    t18 = (
      <Box marginBottom={1} flexDirection="column">
        <Text color="remember" bold={true}>
          {groupCount > 1 ? `Select model · ${filteredOptions.length} available` : `Select model`}
        </Text>
        <Text dimColor={true}>
          {headerText ?? `Switch between models. Applies to this session and future ${getProductName()} sessions.`}
        </Text>
        {t17}
      </Box>
    );
    $[46] = filteredOptions.length;
    $[47] = searchQuery;
    $[48] = t18;
  } else {
    t18 = $[48];
  }

  const t20 = onCancel ?? _temp4;
  let t21;
  if ($[49] !== handleFocus || $[50] !== handleSelect || $[51] !== initialFocusValue || $[52] !== initialValue || $[53] !== selectOptions || $[54] !== t20 || $[55] !== visibleCount) {
    t21 = (
      <Box flexDirection="column">
        <Select
          defaultValue={initialValue}
          defaultFocusValue={initialFocusValue}
          options={selectOptions}
          onChange={handleSelect}
          onFocus={handleFocus}
          onCancel={t20}
          visibleOptionCount={visibleCount}
        />
      </Box>
    );
    $[49] = handleFocus;
    $[50] = handleSelect;
    $[51] = initialFocusValue;
    $[52] = initialValue;
    $[53] = selectOptions;
    $[54] = t20;
    $[55] = visibleCount;
    $[56] = t21;
  } else {
    t21 = $[56];
  }

  let t22;
  if ($[57] !== hiddenCount) {
    t22 = hiddenCount > 0 && (
      <Box paddingLeft={3}>
        <Text dimColor={true}>and {hiddenCount} more models...</Text>
      </Box>
    );
    $[57] = hiddenCount;
    $[58] = t22;
  } else {
    t22 = $[58];
  }

  let t23;
  if ($[59] !== t21 || $[60] !== t22) {
    t23 = (
      <Box flexDirection="column" marginBottom={1}>
        {t21}
        {t22}
      </Box>
    );
    $[59] = t21;
    $[60] = t22;
    $[61] = t23;
  } else {
    t23 = $[61];
  }

  let t24;
  if ($[62] !== displayEffort || $[63] !== focusedDefaultEffort || $[64] !== focusedModelName || $[65] !== focusedSupportsEffort) {
    t24 = (
      <Box marginBottom={1} flexDirection="column">
        {focusedSupportsEffort ? (
          <Text dimColor={true}>
            <EffortLevelIndicator effort={displayEffort} />{" "}
            {capitalize(displayEffort)} effort
            {displayEffort === focusedDefaultEffort ? " (default)" : ""}{" "}
            <Text color="subtle">Left/Right to adjust</Text>
          </Text>
        ) : (
          <Text color="subtle">
            <EffortLevelIndicator effort={undefined} /> Effort not supported
            {focusedModelName ? ` for ${focusedModelName}` : ""}
          </Text>
        )}
      </Box>
    );
    $[62] = displayEffort;
    $[63] = focusedDefaultEffort;
    $[64] = focusedModelName;
    $[65] = focusedSupportsEffort;
    $[66] = t24;
  } else {
    t24 = $[66];
  }

  let t25;
  if ($[67] !== showFastModeNotice) {
    t25 = isFastModeEnabled()
      ? showFastModeNotice ? (
          <Box marginBottom={1}>
            <Text dimColor={true}>
              Fast mode is <Text bold={true}>ON</Text> and available with{" "}
              {FAST_MODE_MODEL_DISPLAY} only (/fast). Switching to other models turns off fast mode.
            </Text>
          </Box>
        ) : isFastModeAvailable() && !isFastModeCooldown() ? (
          <Box marginBottom={1}>
            <Text dimColor={true}>
              Use <Text bold={true}>/fast</Text> to turn on Fast mode ({FAST_MODE_MODEL_DISPLAY} only).
            </Text>
          </Box>
        ) : null
      : null;
    $[67] = showFastModeNotice;
    $[68] = t25;
  } else {
    t25 = $[68];
  }

  let t26b;
  if ($[69] !== t18 || $[70] !== t23 || $[71] !== t24 || $[72] !== t25) {
    t26b = (
      <Box flexDirection="column">
        {t18}
        {t23}
        {t24}
        {t25}
      </Box>
    );
    $[69] = t18;
    $[70] = t23;
    $[71] = t24;
    $[72] = t25;
    $[73] = t26b;
  } else {
    t26b = $[73];
  }

  let t27;
  if ($[74] !== exitState || $[75] !== isStandaloneCommand) {
    t27 = isStandaloneCommand && (
      <Text dimColor={true} italic={true}>
        {exitState.pending ? (
          <>Press {exitState.keyName} again to exit</>
        ) : (
          <Byline>
            <KeyboardShortcutHint shortcut="Enter" action="confirm" />
            <ConfigurableShortcutHint action="select:cancel" context="Select" fallback="Esc" description="exit" />
          </Byline>
        )}
      </Text>
    );
    $[74] = exitState;
    $[75] = isStandaloneCommand;
    $[76] = t27;
  } else {
    t27 = $[76];
  }

  let t28;
  if ($[77] !== t26b || $[78] !== t27) {
    t28 = (
      <Box flexDirection="column">
        {t26b}
        {t27}
      </Box>
    );
    $[77] = t26b;
    $[78] = t27;
    $[79] = t28;
  } else {
    t28 = $[79];
  }
  const content = t28;

  if (!isStandaloneCommand) {
    return content;
  }

  let t29;
  if ($[80] !== content) {
    t29 = <Pane color="permission">{content}</Pane>;
    $[80] = content;
    $[81] = t29;
  } else {
    t29 = $[81];
  }
  return t29;
}

function _temp4() {}
function _temp3(opt_0) {
  return {
    ...opt_0,
    value: opt_0.value === null ? NO_PREFERENCE : opt_0.value
  };
}
function _temp2(s_0) {
  return s_0.effortValue;
}
function _temp(s) {
  return isFastModeEnabled() ? s.fastMode : false;
}
