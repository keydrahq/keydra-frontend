import type { FC, KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import {
  Button,
  Flex,
  FlexItem,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  Popper,
  TextInput,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { completionsFor } from './commandTable';

export interface CommandInputProps {
  isDisabled: boolean;
  /** Lines already run, most recent first, walked by the up arrow. */
  history: string[];
  onSubmit: (line: string) => void;
}

/**
 * The line being typed.
 *
 * <p>Behaves the way a terminal does, because that is what someone opening a console expects: the
 * up arrow walks back through what was run, the down arrow returns, and Tab completes the command
 * name. Suggestions appear only while the first word is being typed — once there is a space, the
 * argument being written is a key or a value, and this has nothing useful to say about it.
 */
export const CommandInput: FC<CommandInputProps> = ({ isDisabled, history, onSubmit }) => {
  const { t } = useTranslation();
  const [line, setLine] = useState('');
  // A real ref rather than a selector: the popper needs an element, and querying the
  // document for one is both slower and wrong when two consoles are on screen.
  const anchor = useRef<HTMLDivElement>(null);
  // -1 means "the line being typed"; 0 and up walk back through history.
  const [recalled, setRecalled] = useState(-1);

  const isFirstWord = !line.includes(' ');
  const completions = isFirstWord ? completionsFor(line) : [];
  const isSuggesting =
    completions.length > 0 &&
    !(completions.length === 1 && completions[0].name === line.toUpperCase());

  const recall = (offset: number) => {
    const next = Math.min(Math.max(recalled + offset, -1), history.length - 1);
    setRecalled(next);
    setLine(next === -1 ? '' : history[next]);
  };

  const submit = () => {
    if (line.trim() === '') {
      return;
    }
    onSubmit(line);
    setLine('');
    setRecalled(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'Enter':
        submit();
        break;
      case 'ArrowUp':
        // Prevent the caret jumping to the start, which is what the browser does otherwise.
        event.preventDefault();
        recall(1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        recall(-1);
        break;
      case 'Tab':
        if (completions.length > 0) {
          event.preventDefault();
          setLine(`${completions[0].name} `);
        }
        break;
      default:
        break;
    }
  };

  const input = (
    <Flex ref={anchor} spaceItems={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'nowrap' }}>
      <FlexItem>
        <span className="keydra-console__prompt" aria-hidden="true">
          &gt;
        </span>
      </FlexItem>
      <FlexItem grow={{ default: 'grow' }}>
        <TextInput
          value={line}
          type="text"
          aria-label={t('Console.INPUT_LABEL')}
          placeholder={t('Console.INPUT_PLACEHOLDER')}
          isDisabled={isDisabled}
          onChange={(_event, next) => {
            setLine(next);
            setRecalled(-1);
          }}
          onKeyDown={onKeyDown}
          className="keydra-console__input"
          autoComplete="off"
          spellCheck={false}
        />
      </FlexItem>
      <FlexItem>
        <Button variant="primary" isDisabled={isDisabled || line.trim() === ''} onClick={submit}>
          {t('Console.RUN')}
        </Button>
      </FlexItem>
    </Flex>
  );

  return (
    <Popper
      trigger={input}
      triggerRef={anchor}
      popper={
        <Menu isScrollable>
          <MenuContent>
            <MenuList>
              {completions.slice(0, 8).map((hint) => (
                <MenuItem
                  key={hint.name}
                  description={`${hint.arguments} — ${hint.summary}`}
                  onClick={() => setLine(`${hint.name} `)}
                >
                  {hint.name}
                </MenuItem>
              ))}
            </MenuList>
          </MenuContent>
        </Menu>
      }
      isVisible={isSuggesting}
      appendTo={() => document.body}
    />
  );
};
