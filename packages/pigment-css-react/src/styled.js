/* eslint-disable no-underscore-dangle */
import * as React from 'react';
import clsx from 'clsx';
import isPropValid from '@emotion/is-prop-valid';

function getVariantClasses(componentProps, variants) {
  const { ownerState = {} } = componentProps;
  const variantClasses = variants
    .filter(({ props: variantProps }) =>
      typeof variantProps === 'function'
        ? variantProps({ ...componentProps, ...componentProps.ownerState })
        : Object.entries(variantProps).every(([propKey, propValue]) => {
            return ownerState[propKey] === propValue || componentProps[propKey] === propValue;
          }),
    )
    .map(({ className }) => className);
  return variantClasses;
}

function isHtmlTag(tag) {
  return (
    typeof tag === 'string' &&
    // 96 is one less than the char code
    // for "a" so this is checking that
    // it's a lowercase character
    tag.charCodeAt(0) > 96
  );
}

const slotShouldForwardProp = (key) => key !== 'as' && key !== 'ownerState';
const rootShouldForwardProp = (key) => slotShouldForwardProp(key) && key !== 'classes';

/**
 * @typedef {(propKey: string) => boolean} ShouldForwardProp
 */

/**
 * This is the runtime `styled` function that finally renders the component
 * after transpilation through WyW-in-JS. It makes sure to add the base classes,
 * variant classes if they satisfy the prop value and also adds dynamic css
 * variables at runtime, if any.
 * @param {string | Function} tag
 * @param {Object} componentMeta
 * @param {string} componentMeta.name
 * @param {string} componentMeta.slot
 * @param {ShouldForwardProp} componentMeta.shouldForwardProp
 * @param {Object} componentMeta.defaultProps Default props object copied over and inlined from theme object
 */
export default function styled(tag, componentMeta = {}) {
  const { name, slot, shouldForwardProp } = componentMeta;

  let finalShouldForwardProp = shouldForwardProp;
  if (!shouldForwardProp) {
    if (isHtmlTag(tag)) {
      finalShouldForwardProp = isPropValid;
    } else if (slot === 'Root' || slot === 'root') {
      finalShouldForwardProp = rootShouldForwardProp;
    } else {
      finalShouldForwardProp = slotShouldForwardProp;
    }
  }
  let shouldUseAs = !finalShouldForwardProp('as');
  if (typeof tag !== 'string' && tag.__styled_by_pigment_css) {
    // If the tag is a Pigment styled component,
    // render the styled component and pass the `as` prop down
    shouldUseAs = false;
  }
  /**
   * This is the runtime `styled` function that finally renders the component
   * after transpilation through WyW-in-JS. It makes sure to add the base classes,
   * variant classes if they satisfy the prop value and also adds dynamic css
   * variables at runtime, if any.
   * @param {string | Function} tag
   * @param {Object} options
   * @param {string} options.displayName Set by WyW-in-JS. Mostly is same as the variable name. For this code, ```const Comp = styled(...)(...)```, `displayName` will be `Comp`.
   * @param {string[]} options.classes List of class names that reference the inline css object styles.
   * @param {Object} options.vars Dynamically generated css variables inlined directly on the element for runtime styling.
   * @param {Object[]} options.variants
   * @param {Object} options.variants.props
   * @param {string} options.variants.className Classname generated for this specific variant through styled processor.
   * @param {string} options.name
   * @param {string} options.slot
   * @param {ShouldForwardProp} options.shouldForwardProp
   */
  function scopedStyledWithOptions(options = {}) {
    const { displayName, classes = [], vars: cssVars = {}, variants = [] } = options;

    const StyledComponent = React.forwardRef(function StyledComponent(inProps, ref) {
      const { className, sx, style, ownerState, ...props } = inProps;
      const Component = (shouldUseAs && inProps.as) || tag;
      const varStyles = Object.entries(cssVars).reduce(
        (acc, [cssVariable, [variableFunction, isUnitLess]]) => {
          const value = variableFunction(inProps);
          if (typeof value === 'undefined') {
            return acc;
          }
          if (typeof value === 'string' || isUnitLess) {
            acc[`--${cssVariable}`] = value;
          } else {
            acc[`--${cssVariable}`] = `${value}px`;
          }
          return acc;
        },
        {},
      );

      const finalClassName = clsx(classes, className, getVariantClasses(inProps, variants));

      if (inProps.as && !shouldForwardProp) {
        // Reassign `shouldForwardProp` if incoming `as` prop is a React component
        if (!isHtmlTag(Component)) {
          if (slot === 'Root' || slot === 'root') {
            finalShouldForwardProp = rootShouldForwardProp;
          } else {
            finalShouldForwardProp = slotShouldForwardProp;
          }
        }
      }

      const newProps = {};
      // eslint-disable-next-line no-restricted-syntax
      for (const key in props) {
        if (shouldUseAs && key === 'as') {
          continue;
        }

        if (finalShouldForwardProp(key) || (!shouldUseAs && key === 'as')) {
          newProps[key] = props[key];
        }
      }

      return (
        <Component
          {...newProps}
          // pass down `ownerState` to nested styled components
          {...(Component.__styled_by_pigment_css && { ownerState })}
          ref={ref}
          className={finalClassName}
          style={{
            ...varStyles,
            ...style,
          }}
        />
      );
    });

    let componentName = displayName;
    if (!componentName && name) {
      componentName = `${name}${slot ? `-${slot}` : ''}`;
    }
    StyledComponent.displayName = `Styled(${componentName})`;
    StyledComponent.__styled_by_pigment_css = true;

    return StyledComponent;
  }

  return scopedStyledWithOptions;
}
