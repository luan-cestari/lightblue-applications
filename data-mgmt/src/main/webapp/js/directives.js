"use strict";

var dataManageDirectives = angular.module("dataManageDirectives", []);

dataManageDirectives.directive("requestCommon", function() {
  return {
    restrict: "E",
    templateUrl: "templates/common.html"
  };
});

dataManageDirectives.directive("lbJsonEditor", ["util", function(util) {
  return {
    restrict: "E",
    require: "ngModel",
    scope: {
      object: "@",
      mode: "@",
      //modes: "@", TODO: follow up on worker mem leak
      search: "=",
      aceConfig: "=",
      ngModelOptions: "="
    },
    link: function($scope, element, attributes, ngModel) {
      /** The JSONEditor instance */
      var editor;

      /** To keep track of "mode" switches and when the first mode is loaded. */
      var oldMode;

      /** Array of events to update the model on */
      var updateOn = ["default"];

      /** Config object for JSONEditor. Needs access to `editor` via closure. */
      var config = {
        change: function() {
          // Change is called on code mode before constructor returns, so do 
          // nothing in that case.
          if (typeof editor === "undefined") {
            return;
          }

          // Ace code editor is present
          if (isNewMode("code") && editor.editor) {
            initAce(editor.editor);
          }

          // Don't trigger model updates from change event if not focused.
          if (editor.editor && !editor.editor.isFocused()) {
            return;
          }

          console.log("change", attributes.ngModel);

          if (util.arrayContains(updateOn, "default") || 
            util.arrayContains(updateOn, "change")) {

            if (util.arrayContains(updateOn, "change")) {
              element.triggerHandler("change");
            }

            $scope.$evalAsync(setViewValue);
          }
        },
        name: $scope.object,
        mode: $scope.mode,
        // Switching modes is somewhat broken until ace editor is properly 
        // destroyed inside the JSONEditor widget.
        // modes: $scope.modes ? $scope.modes.split(",") : undefined,
        search: angular.isDefined($scope.search) ? $scope.search : true
      };

      function isNewMode(mode) {
        if (oldMode === editor.mode) {
          return false;
        }

        oldMode = editor.mode;
        return (mode) ? oldMode === mode : true;
      }

      function initAce(aceEditor) {
        if ($scope.aceConfig && $scope.aceConfig.onLoad) {
          $scope.aceConfig.onLoad(aceEditor);
        }
              
        if (util.arrayContains(updateOn, "blur")) {
          aceEditor.on("blur", function() {
            $scope.$evalAsync(setViewValue);
            element.triggerHandler("blur");
          });
        }
      }

      function setViewValue() {
        try {
          $scope.model = editor.get();
          ngModel.$setViewValue($scope.model);
        } catch (e) {
          return;
        };
      }

      // Set root element display to block so we can hide via CSS position
      // We can't hide with display:none due to https://github.com/angular-ui/ui-ace/issues/18
      // Note even though that issue is in angular-ui, we still see it with the
      // JSONEditor widget (which also uses ace) because it is actually an issue
      // with ace editor itself.
      element.css("display", "block");

      // Initialize updateOn if ngModelOptions has defined it.
      if ($scope.ngModelOptions && $scope.ngModelOptions.updateOn) {
        updateOn = $scope.ngModelOptions.updateOn.toLowerCase().split(" ");
      }

      editor = new JSONEditor(element[0], config);

      // Called when our view needs to be updated. Does not do a deep watch so
      // property updates on the model object will be missed. This is why we
      // also do a deep watch below.
      ngModel.$render = function() {
        $scope.model = ngModel.$viewValue;
      };

      // Deep watch the model for property changes
      $scope.$watch("model", function(newValue) {
        // Avoid updating the editor unnecessarily, which disrupts user input.
        // TODO: optimize? angular.equals is expensive, so is deep watch
        try {
          if (angular.equals(newValue, editor.get())) {
            return;
          }
        } catch (ignored) {
          // Editor's current content is not valid JSON, fall through to 
          // overwrite with new model value.
        }

        // TODO: deal with triggering change event, which redundantly sets view value on model
        console.log("editor.set", attributes.ngModel);
        editor.set(newValue);

        // Editor in tree mode collapses nodes on call to `set`... expand them.
        if(editor.expandAll) {
          editor.expandAll();
        }
      }, true);
    }
  };
}])