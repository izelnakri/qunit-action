import {
  isDocument,
  isElement,
  MouseEventType,
  KeyboardEventType,
  FileSelectionEventType,
  isKeyboardEventType,
  isMouseEventType,
  isFileSelectionEventType,
  isFileSelectionInput,
} from './internal/index';

const MOUSE_EVENT_CONSTRUCTOR = (() => {
  try {
    new MouseEvent('test');

    return true;
  } catch (e) {
    return false;
  }
})();

function fireEvent(
  element: Element | Document | Window,
  eventType: KeyboardEventType,
  options?: any
): Event;
function fireEvent(
  element: Element | Document | Window,
  eventType: MouseEventType,
  options?: any
): Event | void;
function fireEvent(element: Element | Document | Window, eventType: string, options?: any): Event;

function fireEvent(
  element: Element | Document | Window,
  eventType: string,
  options = {}
): Event | void {
  if (!element) {
    throw new Error('Must pass an element to `fireEvent`');
  }

  let event;
  if (isKeyboardEventType(eventType)) {
    event = buildKeyboardEvent(eventType, options);
  } else if (isMouseEventType(eventType)) {
    let rect;

    if (element instanceof Window && element.document.documentElement) {
      rect = element.document.documentElement.getBoundingClientRect();
    } else if (isDocument(element)) {
      rect = element.documentElement!.getBoundingClientRect();
    } else if (isElement(element)) {
      rect = element.getBoundingClientRect();
    } else {
      return;
    }

    const x = rect.left + 1;
    const y = rect.top + 1;
    const simulatedCoordinates = {
      screenX: x + 5, // Those numbers don't really mean anything.
      screenY: y + 95, // They're just to make the screenX/Y be different of clientX/Y..
      clientX: x,
      clientY: y,
    };

    event = buildMouseEvent(eventType, Object.assign(simulatedCoordinates, options));
  } else if (isFileSelectionEventType(eventType) && isFileSelectionInput(element)) {
    event = buildFileEvent(eventType, element, options);
  } else {
    event = buildBasicEvent(eventType, options);
  }

  element.dispatchEvent(event);

  return event;
}

export default fireEvent;

const DEFAULT_EVENT_OPTIONS = { bubbles: true, cancelable: true };

function buildBasicEvent(type: string, options: any = {}): Event {
  let event = document.createEvent('Events');
  let bubbles = options.bubbles !== undefined ? options.bubbles : true;
  let cancelable = options.cancelable !== undefined ? options.cancelable : true;

  delete options.bubbles;
  delete options.cancelable;

  // bubbles and cancelable are readonly, so they can be
  // set when initializing event
  event.initEvent(type, bubbles, cancelable);

  return Object.assign(event, options);
}

function buildMouseEvent(type: MouseEventType, options: any = {}) {
  const eventOpts: any = Object.assign({ view: window }, DEFAULT_EVENT_OPTIONS, options);

  let event;
  if (MOUSE_EVENT_CONSTRUCTOR) {
    event = new MouseEvent(type, eventOpts);
  } else {
    try {
      event = document.createEvent('MouseEvents');
      event.initMouseEvent(
        type,
        eventOpts.bubbles,
        eventOpts.cancelable,
        window,
        eventOpts.detail,
        eventOpts.screenX,
        eventOpts.screenY,
        eventOpts.clientX,
        eventOpts.clientY,
        eventOpts.ctrlKey,
        eventOpts.altKey,
        eventOpts.shiftKey,
        eventOpts.metaKey,
        eventOpts.button,
        eventOpts.relatedTarget
      );
    } catch (e) {
      event = buildBasicEvent(type, options);
    }
  }

  return event;
}

function buildKeyboardEvent(type: KeyboardEventType, options: any = {}) {
  let eventOpts: any = Object.assign({}, DEFAULT_EVENT_OPTIONS, options);
  let event: Event | undefined;
  let eventMethodName: 'initKeyboardEvent' | 'initKeyEvent' | undefined;

  try {
    event = new KeyboardEvent(type, eventOpts);

    // Property definitions are required for B/C for keyboard event usage
    // If this properties are not defined, when listening for key events
    // keyCode/which will be 0. Also, keyCode and which now are string
    // and if app compare it with === with integer key definitions,
    // there will be a fail.
    //
    // https://w3c.github.io/uievents/#interface-keyboardevent
    // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
    Object.defineProperty(event, 'keyCode', {
      get() {
        return parseInt(eventOpts.keyCode);
      },
    });

    Object.defineProperty(event, 'which', {
      get() {
        return parseInt(eventOpts.which);
      },
    });

    return event;
  } catch (e) {
    // left intentionally blank
  }

  try {
    event = document.createEvent('KeyboardEvents');
    eventMethodName = 'initKeyboardEvent';
  } catch (e) {
    // left intentionally blank
  }

  if (!event) {
    try {
      event = document.createEvent('KeyEvents');
      eventMethodName = 'initKeyEvent';
    } catch (e) {
      // left intentionally blank
    }
  }

  if (event && eventMethodName) {
    (event as any)[eventMethodName](
      type,
      eventOpts.bubbles,
      eventOpts.cancelable,
      window,
      eventOpts.ctrlKey,
      eventOpts.altKey,
      eventOpts.shiftKey,
      eventOpts.metaKey,
      eventOpts.keyCode,
      eventOpts.charCode
    );
  } else {
    event = buildBasicEvent(type, options);
  }

  return event;
}

function buildFileEvent(
  type: FileSelectionEventType,
  element: HTMLInputElement,
  options: any = {}
): Event {
  let event = buildBasicEvent(type);
  let files = options.files;

  if (Array.isArray(options)) {
    throw new Error(
      'Please pass an object with a files array to `triggerEvent` instead of passing the `options` param as an array to.'
    );
  }

  if (Array.isArray(files)) {
    Object.defineProperty(files, 'item', {
      value(index: number) {
        return typeof index === 'number' ? this[index] : null;
      },
      configurable: true,
    });
    Object.defineProperty(element, 'files', {
      value: files,
      configurable: true,
    });

    let elementProto = Object.getPrototypeOf(element);
    let valueProp = Object.getOwnPropertyDescriptor(elementProto, 'value');
    Object.defineProperty(element, 'value', {
      configurable: true,
      get() {
        return valueProp!.get!.call(element);
      },
      set(value) {
        valueProp!.set!.call(element, value);

        // We are sure that the value is empty here.
        // For a non-empty value the original setter must raise an exception.
        Object.defineProperty(element, 'files', {
          configurable: true,
          value: [],
        });
      },
    });
  }

  Object.defineProperty(event, 'target', {
    value: element,
  });

  return event;
}
