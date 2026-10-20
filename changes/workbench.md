- The App is rebuilt on the shell's case workbench. The 12 authored networks (and the reader's own design) are the cases
  of the rail's selector; the App has five question groups, Design, Airflow, Transport, Uncertainty and Learned models,
  and the shell's Context view, six peers in one row. The flow and operations modes are merged into Airflow.
- Every tool page of the six old modes is a sub-view of exactly one group (a row of tabs under the group row, at most
  six per group); the 3D scene stays the instrument of every group, with the tool pane floating over its left edge and
  the scene kept alive across sub-views, groups and Focus.
- The rail has three sections shown one at a time: the setpoint (fan speed, resistance scale, open or closed state of
  the selected airway, as registered controls), the solved values (total airflow, fan power, target deficit, airways
  short, mass residual, convergence) and the project (new, load, save, tables, undo, redo, baseline, compare). Every
  control and every edit of the design moves the selection key the views are checked against.
- Focus mode is the shell's: the Focus button beside the case selector opens the open group on the whole stage, with
  four readouts over it (total airflow, fan power, targets short and the group's main value). It is held in the URL
  with the case, the group (`?view=`) and the sub-view (`?sub=`), and Escape returns to the same place. The product's
  own focus toggle and Escape handling are removed.
- The case guide is the Context view: the problem, the components, the equations, the scope, the regimes and how to
  read the views, with its references as one block at its end.
