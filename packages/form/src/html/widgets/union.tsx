// 联合组件: 左侧分支选择 + 右侧由 renderContent() 渲染的当前分支内容; 只有一个分支时不显示选择.
// 分支选择默认为下拉; props.selector 为 "buttons" 且分支不超过 MAX_BUTTON_BRANCHES 个时为分段按钮(一组单选).
import type { ChangeEvent } from 'react';
import { useCopy } from '../copy.js';
import { errorId } from '../ids.js';
import { groupAttributes, type HtmlUnionProps } from '../props.js';
import { ErrorList } from './error-list.js';
import { cn, styles } from '../styles.js';

export const MAX_BUTTON_BRANCHES = 4;

/** 分支选择的形态: props.selector 为 "buttons" 且分支不多时用分段按钮, 否则用下拉. */
export function branchSelector(props: Pick<HtmlUnionProps, 'props' | 'branches'>): 'select' | 'buttons' {
  return props.props['selector'] === 'buttons' && props.branches.length <= MAX_BUTTON_BRANCHES ? 'buttons' : 'select';
}

function BranchSelect({ props }: { props: HtmlUnionProps }) {
  const COPY = useCopy();
  return (
    <select
      id={`${props.id}-branch`}
      aria-label={COPY.branch}
      className={`jotl-select ${styles.select()}`}
      value={String(props.activeBranch)}
      disabled={props.mode !== 'edit'}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => props.selectBranch(Number(e.target.value))}
    >
      {props.branches.map((branch, i) => (
        <option key={i} value={String(i)}>
          {branch.title}
        </option>
      ))}
    </select>
  );
}

function BranchButtons({ props }: { props: HtmlUnionProps }) {
  const COPY = useCopy();
  const optionId = (i: number) => `${props.id}-branch-${i}`;
  return (
    <div role="radiogroup" aria-label={COPY.branch} className={`jotl-union-buttons ${styles.segmented}`}>
      {props.branches.map((branch, i) => (
        <label key={i} htmlFor={optionId(i)} className={cn('jotl-union-button', styles.segment)}>
          <input
            id={optionId(i)}
            type="radio"
            className={styles.visuallyHidden}
            name={`${props.id}-branch`}
            value={String(i)}
            checked={i === props.activeBranch}
            disabled={props.mode !== 'edit'}
            onChange={() => props.selectBranch(i)}
          />
          {branch.title}
        </label>
      ))}
    </div>
  );
}

export function UnionWidget(props: HtmlUnionProps) {
  const Selector = branchSelector(props) === 'buttons' ? BranchButtons : BranchSelect;
  return (
    <div {...groupAttributes(props.id, props.errors)} className={`jotl-union ${styles.union}`}>
      <div className={`jotl-union-row ${styles.unionRow}`}>
        {props.branches.length > 1 && (
          <div className={`jotl-union-branch ${styles.unionBranch}`}>
            <Selector props={props} />
          </div>
        )}
        <div className={`jotl-union-content ${styles.unionContent}`}>{props.renderContent()}</div>
      </div>
      {props.errors.length > 0 && <ErrorList id={errorId(props.id)} errors={props.errors} />}
    </div>
  );
}
