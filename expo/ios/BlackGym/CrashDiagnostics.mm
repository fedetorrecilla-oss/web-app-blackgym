// BLACKGYM CRASH DIAGNOSTICS — std::terminate handler (installed before main).
// See plugins/withCrashDiagnostics.js for the rationale.

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

#include <exception>
#include <execinfo.h>

static std::terminate_handler g_previousTerminateHandler = nullptr;

static void BlackGymWriteReport(NSString *report) {
  NSLog(@"%@", report);

  NSArray<NSString *> *caches =
      NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
  NSString *path = [caches.firstObject stringByAppendingPathComponent:@"blackgym_last_crash.txt"];
  [report writeToFile:path atomically:YES encoding:NSUTF8StringEncoding error:NULL];

  // Survives relaunch: the user can paste this into Notes even while the app
  // keeps crashing at launch.
  UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
  pasteboard.string = report;
}

// ObjC and C++ exceptions share the Itanium ABI on arm64, so the in-flight
// exception can be re-thrown and re-caught to identify its type.
static NSString *BlackGymDescribeObjCException(std::exception_ptr eptr) {
  @try {
    std::rethrow_exception(eptr);
  } @catch (NSException *exception) {
    NSString *stack = [exception.callStackSymbols componentsJoinedByString:@"\n"];
    return [NSString stringWithFormat:@"ObjC NSException\nname: %@\nreason: %@\nstack:\n%@",
                                      exception.name, exception.reason ?: @"(none)", stack];
  } @catch (...) {
    return nil;
  }
}

static NSString *BlackGymDescribeCppException(std::exception_ptr eptr) {
  try {
    std::rethrow_exception(eptr);
  } catch (const std::exception &e) {
    void *frames[64];
    int count = backtrace(frames, 64);
    char **symbols = backtrace_symbols(frames, count);
    NSMutableString *stack = [NSMutableString string];
    for (int i = 0; i < count; i++) {
      [stack appendFormat:@"%s\n", symbols[i]];
    }
    free(symbols);
    return [NSString stringWithFormat:@"C++ std::exception\nwhat(): %s\nbacktrace:\n%@", e.what(), stack];
  } catch (...) {
    return @"C++ exception of unknown type";
  }
}

static void BlackGymTerminateHandler(void) {
  NSMutableString *report =
      [NSMutableString stringWithString:@"[Black Gym] std::terminate — uncaught exception\n"];

  std::exception_ptr eptr = std::current_exception();
  if (eptr) {
    NSString *description = BlackGymDescribeObjCException(eptr);
    if (!description) {
      description = BlackGymDescribeCppException(eptr);
    }
    [report appendFormat:@"%@\n", description];
  } else {
    [report appendString:@"(no active exception)\n"];
  }

  BlackGymWriteReport(report);

  if (g_previousTerminateHandler) {
    g_previousTerminateHandler();
  } else {
    abort();
  }
}

__attribute__((constructor)) static void BlackGymInstallTerminateHandler(void) {
  g_previousTerminateHandler = std::set_terminate(&BlackGymTerminateHandler);
}
